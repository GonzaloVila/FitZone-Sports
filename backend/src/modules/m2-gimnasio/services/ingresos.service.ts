import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import type { RolUsuario } from '../../m1-usuarios/entities/usuario.entity';
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
import {
  accesoDuplicado,
  aforoLleno,
  egresoDuplicado,
  egresoFueraDeSede,
  membresiaInactiva,
} from '../errors/ingresos.errors';
import { IngresoRepository } from '../repositories/ingreso.repository';
import type { IngresoFiltros } from '../repositories/ingreso.repository';
import { SedeRepository } from '../repositories/sede.repository';

// Alcance por rol para el listado y el egreso (RF-04/Unidad III). RECEPCION queda
// atado a su sede (la del JWT, que sale de EmpleadoSede); GERENTE ve y egresa en
// cualquier sede, así que su scope no filtra. Se modela como dato y no como dos
// métodos distintos: el service decide con la misma función en los dos casos.
export interface ScopeIngreso {
  rol: RolUsuario;
  sedeId?: number;
}

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
    const sede = await this.sedes.buscarPorId(dto.sedeId);
    if (!sede) {
      throw recursoNoEncontrado('No existe la sede indicada.');
    }

    // Solo entran socios (RF-04), y con membresia vigente. La vigencia se
    // consulta por socio; un socio inactivo (baja logica) da no-vigente.
    const estado = await this.membresias.consultarVigenciaPorSocio(dto.socioId);
    if (!estado.vigente) {
      throw membresiaInactiva(dto.socioId, dto.sedeId);
    }

    // codigoTotp viene siempre (DTO lo exige); solo se verifica contra el
    // secreto si el socio activo el QR dinamico (POST /auth/registro-qr). Si
    // nunca lo activo, se permite igual (backward compatibility, ver plan).
    await this.totp.validarIngreso(dto.socioId, dto.codigoTotp);

    // Atajo para el caso común: evita llegar al INSERT cuando ya sabemos que
    // el socio está dentro. Corre fuera de la transacción, así que no es la
    // garantía de RN-01: dos accesos simultáneos pueden pasar los dos este
    // chequeo. Quien cierra eso es el índice parcial único, que rechaza el
    // segundo INSERT y vuelve por crear() como ACCESO_DUPLICADO.
    const ingresoActivo = await this.ingresos.buscarActivoPorSocio(dto.socioId);
    if (ingresoActivo) {
      throw accesoDuplicado(dto.socioId);
    }

    const resultado = await this.ingresos.crear({
      sedeId: dto.sedeId,
      socioId: dto.socioId,
      fechaHoraIngreso: dto.fechaHoraIngreso ? new Date(dto.fechaHoraIngreso) : undefined,
      validadoOffline: dto.validadoOffline ?? false,
    });

    if (!resultado.ok) {
      // El motivo importa: los dos casos son 409 pero con problemas distintos.
      // Si llegamos aquí con ACCESO_DUPLICADO, es que el índice único atajó un
      // acceso duplicado que el chequeo previo no llegó a ver.
      if (resultado.motivo === 'ACCESO_DUPLICADO') {
        throw accesoDuplicado(dto.socioId);
      }
      throw aforoLleno(dto.sedeId, sede.aforoMaximo);
    }

    return this.aOut(resultado.ingreso);
  }

  async listar(
    filtros: IngresoFiltros,
    opciones: OpcionesPaginacion,
    scope: ScopeIngreso,
  ): Promise<IngresoOut[]> {
    // RECEPCION solo ve su sede: se FUERZA el sedeId del JWT y se ignora el que
    // venga en el query (si viniera otro). GERENTE usa el filtro tal cual.
    const filtrosEfectivos =
      scope.rol === 'RECEPCION' && scope.sedeId !== undefined
        ? { ...filtros, sedeId: scope.sedeId }
        : filtros;
    const filas = await this.ingresos.listar(filtrosEfectivos, opciones);
    return filas.map((ingreso) => this.aOut(ingreso));
  }

  async obtenerIngreso(ingresoId: number): Promise<IngresoOut> {
    const ingreso = await this.ingresos.buscarPorId(ingresoId);
    if (!ingreso) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(ingreso);
  }

  async registrarEgreso(ingresoId: number, scope: ScopeIngreso): Promise<void> {
    const ingreso = await this.ingresos.buscarPorId(ingresoId);
    if (!ingreso) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }

    // RECEPCION solo egresa en su sede. El 403 va antes del chequeo de egreso
    // duplicado a propósito: no se filtra el estado de un ingreso de otra sede.
    if (scope.rol === 'RECEPCION' && scope.sedeId !== ingreso.sedeId) {
      throw egresoFueraDeSede(ingresoId);
    }

    if (ingreso.fechaHoraEgreso) {
      throw egresoDuplicado(ingresoId);
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
      aforoActual: aforoActual,
      aforoMaximo: sede.aforoMaximo,
      restante: sede.aforoMaximo - aforoActual,
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
      const estado = await this.membresias.consultarVigenciaPorSocio(ing.socioId);
      if (!estado.vigente) {
        resultados.push(
          this.resultadoIngreso(ing.localId, false, {
            error: 'USUARIO_BLOQUEADO',
            detalle: `El socio ${ing.socioId} no posee una membresía vigente.`,
          }),
        );
        continue;
      }

      const activo = await this.ingresos.buscarActivoPorSocio(ing.socioId);
      if (activo) {
        resultados.push(
          this.resultadoIngreso(ing.localId, false, {
            error: 'YA_DENTRO',
            detalle: `El socio ${ing.socioId} ya tiene un ingreso sin egreso (sede ${activo.sedeId}).`,
          }),
        );
        continue;
      }

      const resultado = await this.ingresos.crear({
        sedeId: sedeId,
        socioId: ing.socioId,
        fechaHoraIngreso: new Date(ing.fechaHoraIngreso),
        validadoOffline: true,
      });

      if (!resultado.ok) {
        resultados.push(
          this.resultadoIngreso(ing.localId, false, {
            error: resultado.motivo === 'AFORO_LLENO' ? 'AFORO_LLENO' : 'YA_DENTRO',
            detalle:
              resultado.motivo === 'AFORO_LLENO'
                ? `La sede ${sedeId} alcanzó su aforo máximo.`
                : `El socio ${ing.socioId} ya tiene un ingreso sin egreso (RN-01).`,
          }),
        );
        continue;
      }

      localAServerId.set(ing.localId, resultado.ingreso.id);
      resultados.push(this.resultadoIngreso(ing.localId, true, { serverId: resultado.ingreso.id }));
    }

    const egresosProcesados: ResultadoEgresoOut[] = [];
    for (const egr of dto.egresos ?? []) {
      // ingresoLocalId referencia un localId del MISMO lote (ver DTO): un
      // ingreso ya sincronizado en un envío anterior no tiene localId que
      // resolver acá, porque ya quedó con su serverId propio.
      const serverId = localAServerId.get(egr.ingresoLocalId);
      if (serverId === undefined) {
        egresosProcesados.push(
          this.resultadoEgreso(egr.localId, false, {
            error: 'INGRESO_NO_ENCONTRADO',
            detalle: `No se encontró el ingreso local ${egr.ingresoLocalId} en este lote.`,
          }),
        );
        continue;
      }

      const ingresoActual = await this.ingresos.buscarPorId(serverId);
      if (!ingresoActual) {
        egresosProcesados.push(
          this.resultadoEgreso(egr.localId, false, {
            error: 'INGRESO_NO_ENCONTRADO',
            detalle: `El ingreso ${serverId} no existe.`,
          }),
        );
        continue;
      }
      if (ingresoActual.fechaHoraEgreso) {
        egresosProcesados.push(
          this.resultadoEgreso(egr.localId, false, {
            error: 'EGRESO_DUPLICADO',
            detalle: `El ingreso ${serverId} ya tiene egreso registrado.`,
          }),
        );
        continue;
      }

      await this.ingresos.marcarEgreso(serverId, new Date(egr.fechaHoraEgreso));
      egresosProcesados.push(this.resultadoEgreso(egr.localId, true));
    }

    return plainToInstance(SincronizarIngresosOut, {
      resultados,
      egresosProcesados: egresosProcesados,
    });
  }

  private resultadoIngreso(
    localId: number,
    ok: boolean,
    extra: Partial<Pick<ResultadoIngresoOut, 'serverId' | 'error' | 'detalle'>> = {},
  ): ResultadoIngresoOut {
    return plainToInstance(ResultadoIngresoOut, { localId: localId, ok, ...extra });
  }

  private resultadoEgreso(
    localId: number,
    ok: boolean,
    extra: Partial<Pick<ResultadoEgresoOut, 'error' | 'detalle'>> = {},
  ): ResultadoEgresoOut {
    return plainToInstance(ResultadoEgresoOut, { localId: localId, ok, ...extra });
  }

  private aOut(ingreso: Ingreso): IngresoOut {
    return plainToInstance(IngresoOut, ingreso);
  }
}
