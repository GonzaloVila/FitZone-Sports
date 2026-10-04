import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ProblemException, recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import { TotpService } from '../../auth/services/totp.service';
import { AforoOut } from '../dtos/aforo-out.dto';
import { IngresoIn } from '../dtos/ingreso-in.dto';
import { IngresoOut } from '../dtos/ingreso-out.dto';
import { SincronizarIngresosIn } from '../dtos/sincronizar-ingresos-in.dto';
import {
  ResultadoEgresoOut,
  ResultadoIngresoOut,
  SincronizarIngresosOut,
} from '../dtos/sincronizar-ingresos-out.dto';
import { Ingreso } from '../entities/ingreso.entity';
import { IngresoRepository } from '../repositories/ingreso.repository';
import type { IngresoFiltros } from '../repositories/ingreso.repository';
import { SedeRepository } from '../repositories/sede.repository';

@Injectable()
export class IngresosService {
  constructor(
    private readonly ingresos: IngresoRepository,
    private readonly sedes: SedeRepository,
    // RF-04: la vigencia la decide M1. Antes venía por un puerto con `@Optional()`
    // y se trataba como `null` si no estaba registrado, lo que hacia fallar el
    // acceso por una razon equivocada. Ahora la dependencia es obligatoria: si M1
    // no esta disponible la app ni arranca.
    private readonly membresias: MembresiasService,
    // RF-04 (QR dinamico, Unidad III): mismo criterio, dependencia obligatoria
    // vía imports en vez de un puerto opcional.
    private readonly totp: TotpService,
  ) {}

  async registrarIngreso(dto: IngresoIn): Promise<IngresoOut> {
    const sede = await this.sedes.buscarPorId(dto.sede_id);
    if (!sede) {
      throw recursoNoEncontrado('No existe la sede indicada.');
    }

    const vigencia = await this.membresias.consultarVigencia(dto.usuario_id);
    if (!vigencia.vigente) {
      throw new ProblemException({
        type: 'https://fitzone.app/errores/membresia-inactiva',
        title: 'Membresía inactiva',
        status: HttpStatus.FORBIDDEN,
        detail: `El usuario ${dto.usuario_id} no posee una membresía vigente para ingresar a la sede ${dto.sede_id}.`,
      });
    }

    // codigo_totp viene siempre (DTO lo exige); solo se verifica contra el
    // secreto si el socio activo el QR dinamico (POST /auth/registro-qr). Si
    // nunca lo activo, se permite igual (backward compatibility, ver plan).
    await this.totp.validarIngreso(dto.usuario_id, dto.codigo_totp);

    // Atajo para el caso común: evita llegar al INSERT cuando ya sabemos que
    // el usuario está dentro. Corre fuera de la transacción, así que no es la
    // garantía de RN-01: dos accesos simultáneos pueden pasar los dos este
    // chequeo. Quien cierra eso es el índice parcial único, que rechaza el
    // segundo INSERT y vuelve por crear() como ACCESO_DUPLICADO.
    const ingresoActivo = await this.ingresos.buscarActivoPorUsuario(dto.usuario_id);
    if (ingresoActivo) {
      throw this.accesoDuplicado(dto.usuario_id);
    }

    const resultado = await this.ingresos.crear({
      sede_id: dto.sede_id,
      usuario_id: dto.usuario_id,
      fecha_hora_ingreso: dto.fecha_hora_ingreso ? new Date(dto.fecha_hora_ingreso) : undefined,
      validado_offline: dto.validado_offline ?? false,
    });

    if (!resultado.ok) {
      // El motivo importa: los dos casos son 409 pero con problemas distintos.
      // Si llegamos aquí con ACCESO_DUPLICADO, es que el índice único atajó un
      // acceso duplicado que el chequeo previo no llegó a ver.
      if (resultado.motivo === 'ACCESO_DUPLICADO') {
        throw this.accesoDuplicado(dto.usuario_id);
      }
      throw new ProblemException({
        type: 'https://fitzone.app/errores/aforo-lleno',
        title: 'Aforo de la sede completo',
        status: HttpStatus.CONFLICT,
        detail: `La sede ${dto.sede_id} alcanzó su aforo máximo (${sede.aforo_maximo} personas); no se admiten más ingresos (RF-05).`,
      });
    }

    return this.aOut(resultado.ingreso);
  }

  async listar(filtros: IngresoFiltros, opciones: OpcionesPaginacion): Promise<IngresoOut[]> {
    const filas = await this.ingresos.listar(filtros, opciones);
    return filas.map((ingreso) => this.aOut(ingreso));
  }

  async obtenerIngreso(ingresoId: number): Promise<IngresoOut> {
    const ingreso = await this.ingresos.buscarPorId(ingresoId);
    if (!ingreso) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(ingreso);
  }

  async registrarEgreso(ingresoId: number): Promise<void> {
    const ingreso = await this.ingresos.buscarPorId(ingresoId);
    if (!ingreso) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    if (ingreso.fecha_hora_egreso) {
      throw new ProblemException({
        type: 'https://fitzone.app/errores/egreso-duplicado',
        title: 'Egreso duplicado',
        status: HttpStatus.CONFLICT,
        detail: `El ingreso ${ingresoId} ya tiene fecha_hora_egreso; no se puede egresar dos veces.`,
      });
    }

    await this.ingresos.marcarEgreso(ingresoId, new Date());
  }

  async obtenerAforo(sedeId: number): Promise<AforoOut> {
    const sede = await this.sedes.buscarPorId(sedeId);
    if (!sede) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }

    const aforoActual = await this.ingresos.contarActivosPorSede(sedeId);

    return plainToInstance(AforoOut, {
      aforo_actual: aforoActual,
      aforo_maximo: sede.aforo_maximo,
      restante: sede.aforo_maximo - aforoActual,
    });
  }

  // POST /sincronizacion/ingresos (RNF-01, Fase 5). `sedeId` viene del JWT del
  // RECEPCION (no del body): un puesto solo sincroniza ingresos de su propia
  // sede. Por item, nunca lanza: un lote offline puede traer decenas de
  // ingresos y un solo fallo no debe tirar abajo a los demás, a diferencia de
  // registrarIngreso() donde cada request es un solo ingreso y sí corresponde
  // 403/409. Sin TOTP acá: el puesto offline ya filtró contra su copia local
  // de /bloqueados (RNF-01), no contra el servidor.
  async sincronizar(dto: SincronizarIngresosIn, sedeId: number): Promise<SincronizarIngresosOut> {
    const resultados: ResultadoIngresoOut[] = [];
    const localAServerId = new Map<number, number>();

    for (const ing of dto.ingresos) {
      const vigencia = await this.membresias.consultarVigencia(ing.usuario_id);
      if (!vigencia.vigente) {
        resultados.push(
          this.resultadoIngreso(ing.local_id, false, {
            error: 'USUARIO_BLOQUEADO',
            detalle: `El usuario ${ing.usuario_id} no posee una membresía vigente.`,
          }),
        );
        continue;
      }

      const activo = await this.ingresos.buscarActivoPorUsuario(ing.usuario_id);
      if (activo) {
        resultados.push(
          this.resultadoIngreso(ing.local_id, false, {
            error: 'YA_DENTRO',
            detalle: `El usuario ${ing.usuario_id} ya tiene un ingreso sin egreso (sede ${activo.sede_id}).`,
          }),
        );
        continue;
      }

      const resultado = await this.ingresos.crear({
        sede_id: sedeId,
        usuario_id: ing.usuario_id,
        fecha_hora_ingreso: new Date(ing.fecha_hora_ingreso),
        validado_offline: true,
      });

      if (!resultado.ok) {
        resultados.push(
          this.resultadoIngreso(ing.local_id, false, {
            error: resultado.motivo === 'AFORO_LLENO' ? 'AFORO_LLENO' : 'YA_DENTRO',
            detalle:
              resultado.motivo === 'AFORO_LLENO'
                ? `La sede ${sedeId} alcanzó su aforo máximo.`
                : `El usuario ${ing.usuario_id} ya tiene un ingreso sin egreso (RN-01).`,
          }),
        );
        continue;
      }

      localAServerId.set(ing.local_id, resultado.ingreso.id);
      resultados.push(this.resultadoIngreso(ing.local_id, true, { server_id: resultado.ingreso.id }));
    }

    const egresosProcesados: ResultadoEgresoOut[] = [];
    for (const egr of dto.egresos ?? []) {
      // ingreso_local_id referencia un local_id del MISMO lote (ver DTO): un
      // ingreso ya sincronizado en un envío anterior no tiene local_id que
      // resolver acá, porque ya quedó con su server_id propio.
      const serverId = localAServerId.get(egr.ingreso_local_id);
      if (serverId === undefined) {
        egresosProcesados.push(
          this.resultadoEgreso(egr.local_id, false, {
            error: 'INGRESO_NO_ENCONTRADO',
            detalle: `No se encontró el ingreso local ${egr.ingreso_local_id} en este lote.`,
          }),
        );
        continue;
      }

      const ingresoActual = await this.ingresos.buscarPorId(serverId);
      if (!ingresoActual) {
        egresosProcesados.push(
          this.resultadoEgreso(egr.local_id, false, {
            error: 'INGRESO_NO_ENCONTRADO',
            detalle: `El ingreso ${serverId} no existe.`,
          }),
        );
        continue;
      }
      if (ingresoActual.fecha_hora_egreso) {
        egresosProcesados.push(
          this.resultadoEgreso(egr.local_id, false, {
            error: 'EGRESO_DUPLICADO',
            detalle: `El ingreso ${serverId} ya tiene egreso registrado.`,
          }),
        );
        continue;
      }

      await this.ingresos.marcarEgreso(serverId, new Date(egr.fecha_hora_egreso));
      egresosProcesados.push(this.resultadoEgreso(egr.local_id, true));
    }

    return plainToInstance(SincronizarIngresosOut, {
      resultados,
      egresos_procesados: egresosProcesados,
    });
  }

  private resultadoIngreso(
    localId: number,
    ok: boolean,
    extra: Partial<Pick<ResultadoIngresoOut, 'server_id' | 'error' | 'detalle'>> = {},
  ): ResultadoIngresoOut {
    return plainToInstance(ResultadoIngresoOut, { local_id: localId, ok, ...extra });
  }

  private resultadoEgreso(
    localId: number,
    ok: boolean,
    extra: Partial<Pick<ResultadoEgresoOut, 'error' | 'detalle'>> = {},
  ): ResultadoEgresoOut {
    return plainToInstance(ResultadoEgresoOut, { local_id: localId, ok, ...extra });
  }

  private aOut(ingreso: Ingreso): IngresoOut {
    return plainToInstance(IngresoOut, ingreso);
  }

  // 409 acceso-duplicado (RN-01), compartido entre el atajo previo y el que
  // devuelve el índice único, para que los dos caminos emitan exactamente la
  // misma problem+json.
  private accesoDuplicado(usuarioId: number): ProblemException {
    return new ProblemException({
      type: 'https://fitzone.app/errores/acceso-duplicado',
      title: 'Acceso duplicado',
      status: HttpStatus.CONFLICT,
      detail: `El usuario ${usuarioId} ya tiene un ingreso sin egreso registrado (RN-01).`,
    });
  }
}
