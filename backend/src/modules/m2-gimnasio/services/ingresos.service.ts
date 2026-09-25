import { HttpStatus, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ProblemException } from '../../../commons/filters/problem.exception';
import {
  MEMBERSHIP_VALIDATION_PORT,
  MembershipValidationPort,
} from '../../../commons/membresia/membership-validation.port';
import { AforoOutDto } from '../dtos/aforo-out.dto';
import { IngresoInDto } from '../dtos/ingreso-in.dto';
import { IngresoOutDto } from '../dtos/ingreso-out.dto';
import { Ingreso } from '../entities/ingreso.entity';
import { INGRESO_REPOSITORY, IngresoRepository } from '../repositories/ingreso.repository';
import { SEDE_REPOSITORY, SedeRepository } from '../repositories/sede.repository';

@Injectable()
export class IngresosService {
  constructor(
    @Inject(INGRESO_REPOSITORY) private readonly ingresos: IngresoRepository,
    @Inject(SEDE_REPOSITORY) private readonly sedes: SedeRepository,
    // @Optional(): si M1 todavía no registró el adaptador, se rechaza el
    // acceso en vez de romper el arranque de la app (fail-closed, RF-04).
    @Optional()
    @Inject(MEMBERSHIP_VALIDATION_PORT)
    private readonly membresias: MembershipValidationPort | null,
  ) {}

  async registrarIngreso(dto: IngresoInDto): Promise<IngresoOutDto> {
    const sede = await this.sedes.buscarPorId(dto.sede_id);
    if (!sede) {
      throw new NotFoundException('No existe la sede indicada.');
    }

    // qr_token solo se exige presente (validación de DTO): el mecanismo de QR
    // dinámico y dónde persistir su secreto quedan pendientes de definir con
    // la cátedra (fuera de este alcance); ver Plan_de_Trabajo_M2, sección 1.1.
    const vigencia = await this.membresias?.consultarVigencia(dto.usuario_id);
    if (!vigencia?.vigente) {
      throw new ProblemException({
        type: 'https://fitzone.app/errores/membresia-inactiva',
        title: 'Membresía inactiva',
        status: HttpStatus.FORBIDDEN,
        detail: `El usuario ${dto.usuario_id} no posee una membresía ACTIVA para ingresar a la sede ${dto.sede_id}.`,
      });
    }

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

  async registrarEgreso(ingresoId: number): Promise<void> {
    const ingreso = await this.ingresos.buscarPorId(ingresoId);
    if (!ingreso) {
      throw new NotFoundException('No existe el recurso solicitado para el id indicado.');
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

  async obtenerAforo(sedeId: number): Promise<AforoOutDto> {
    const sede = await this.sedes.buscarPorId(sedeId);
    if (!sede) {
      throw new NotFoundException('No existe el recurso solicitado para el id indicado.');
    }

    const aforoActual = await this.ingresos.contarActivosPorSede(sedeId);

    return plainToInstance(AforoOutDto, {
      aforo_actual: aforoActual,
      aforo_maximo: sede.aforo_maximo,
      restante: sede.aforo_maximo - aforoActual,
    });
  }

  private aOut(ingreso: Ingreso): IngresoOutDto {
    return plainToInstance(IngresoOutDto, ingreso);
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
