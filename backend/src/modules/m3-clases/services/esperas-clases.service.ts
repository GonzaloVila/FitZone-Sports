import {
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ProblemException, recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import {
  MEMBERSHIP_VALIDATION_PORT,
  type MembershipValidationPort,
} from '../../../commons/membresia/membership-validation.port';
import { EsperaIn } from '../dtos/espera-in.dto';
import { EsperaOut } from '../dtos/espera-out.dto';
import { ListarEsperaDeClaseQueryDto } from '../dtos/listar-espera-de-clase-query.dto';
import { ListarEsperasClaseQueryDto } from '../dtos/listar-esperas-clase-query.dto';
import { ReservaClaseOut } from '../dtos/reserva-clase-out.dto';
import {
  CLASE_REPOSITORY,
  type ClaseRepository,
} from '../repositories/clase.repository';
import {
  ESPERA_CLASE_REPOSITORY,
  type EsperaClaseRepository,
} from '../repositories/espera-clase.repository';

@Injectable()
export class EsperasClasesService {
  constructor(
    @Inject(ESPERA_CLASE_REPOSITORY)
    private readonly esperasRepo: EsperaClaseRepository,
    @Inject(CLASE_REPOSITORY)
    private readonly clasesRepo: ClaseRepository,
    @Optional()
    @Inject(MEMBERSHIP_VALIDATION_PORT)
    private readonly membresias: MembershipValidationPort | null,
  ) {}

  async listarEsperaDeClase(
    claseId: number,
    filtros: ListarEsperaDeClaseQueryDto,
  ): Promise<EsperaOut[]> {
    const clase = await this.clasesRepo.buscarPorId(claseId);
    if (!clase) {
      throw recursoNoEncontrado('No existe la clase indicada.');
    }

    const esperas = await this.esperasRepo.listar(
      { clase_id: claseId, estado: filtros.estado },
      { page: filtros.page ?? 1, perPage: filtros.per_page ?? 20 },
    );

    return plainToInstance(EsperaOut, esperas);
  }

  async listarEsperasClase(
    filtros: ListarEsperasClaseQueryDto,
  ): Promise<EsperaOut[]> {
    const esperas = await this.esperasRepo.listar(
      {
        clase_id: filtros.clase_id,
        socio_id: filtros.socio_id,
        estado: filtros.estado,
      },
      { page: filtros.page ?? 1, perPage: filtros.per_page ?? 20 },
    );

    return plainToInstance(EsperaOut, esperas);
  }

  async anotarseEnEspera(claseId: number, dto: EsperaIn): Promise<EsperaOut> {
    const clase = await this.clasesRepo.buscarPorId(claseId);
    if (!clase) {
      throw recursoNoEncontrado('No existe la clase indicada.');
    }

    if (new Date(clase.horario).getTime() <= Date.now()) {
      throw new ProblemException({
        type: 'https://fitzone.app/errores/clase-pasada',
        title: 'Clase no disponible',
        status: HttpStatus.CONFLICT,
        detail: 'No es posible anotarse en espera para una clase que ya comenzó o ha finalizado.',
      });
    }

    if (this.membresias) {
      const estado = await this.membresias.consultarVigenciaPorSocio(dto.socio_id);
      if (!estado.esSocio) {
        throw recursoNoEncontrado('El socio indicado no existe.');
      }
      if (estado.enMora || !estado.vigente) {
        throw new ProblemException({
          type: 'https://fitzone.app/errores/socio-en-mora',
          title: 'Socio en mora',
          status: HttpStatus.FORBIDDEN,
          detail: `El socio ${dto.socio_id} posee cuotas vencidas. No puede ingresar a la lista de espera de clases bonificadas.`,
        });
      }
    }

    const resultado = await this.esperasRepo.crear({
      clase_id: claseId,
      socio_id: dto.socio_id,
      estado: 'EN_ESPERA',
      fecha_anotacion: new Date(),
    });

    if (!resultado.ok) {
      if (resultado.motivo === 'CUPO_DISPONIBLE') {
        throw new ProblemException({
          type: 'https://fitzone.app/errores/cupo-disponible',
          title: 'Cupo disponible',
          status: HttpStatus.CONFLICT,
          detail: `La clase ${claseId} aún cuenta con lugares disponibles (${clase.cupo_disponible}). Puede reservar directamente sin ingresar a la lista de espera.`,
        });
      }

      if (resultado.motivo === 'ESPERA_EXISTENTE') {
        throw new ProblemException({
          type: 'https://fitzone.app/errores/espera-existente',
          title: 'Espera o reserva existente',
          status: HttpStatus.CONFLICT,
          detail: `El socio ${dto.socio_id} ya se encuentra inscripto en espera o ya posee una reserva confirmada para la clase ${claseId}.`,
        });
      }

      throw recursoNoEncontrado('No existe la clase indicada.');
    }

    return plainToInstance(EsperaOut, resultado.espera);
  }

  async obtenerEspera(esperaId: number): Promise<EsperaOut> {
    const espera = await this.esperasRepo.buscarPorId(esperaId);
    if (!espera) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return plainToInstance(EsperaOut, espera);
  }

  async salirDeEspera(esperaId: number): Promise<void> {
    const espera = await this.esperasRepo.buscarPorId(esperaId);
    if (!espera) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }

    if (espera.estado === 'CONFIRMADO') {
      throw new ProblemException({
        type: 'https://fitzone.app/errores/espera-confirmada',
        title: 'Espera confirmada',
        status: HttpStatus.CONFLICT,
        detail: 'La solicitud de espera ya fue confirmada como reserva; debe gestionarse desde la cancelación de reservas.',
      });
    }

    if (espera.estado === 'CANCELADO') {
      return;
    }

    await this.esperasRepo.marcarCancelada(esperaId);
  }

  async confirmarEspera(esperaId: number): Promise<ReservaClaseOut> {
    const resultado = await this.esperasRepo.confirmarEsperaConLock(esperaId);

    if (!resultado.ok) {
      if (resultado.motivo === 'ESPERA_INEXISTENTE') {
        throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
      }

      if (resultado.motivo === 'NO_NOTIFICADA') {
        throw new ProblemException({
          type: 'https://fitzone.app/errores/espera-no-notificada',
          title: 'Confirmación rechazada',
          status: HttpStatus.CONFLICT,
          detail: 'No es posible confirmar la espera porque aún no ha sido notificada con un cupo disponible.',
        });
      }

      if (resultado.motivo === 'CUPO_TOMADO') {
        throw new ProblemException({
          type: 'https://fitzone.app/errores/cupo-tomado',
          title: 'Cupo liberado tomado',
          status: HttpStatus.CONFLICT,
          detail: 'El lugar liberado ya fue tomado por otro socio que confirmó primero (first-come).',
        });
      }

      throw new ProblemException({
        type: 'https://fitzone.app/errores/reserva-duplicada',
        title: 'Reserva duplicada',
        status: HttpStatus.CONFLICT,
        detail: 'El socio ya posee una reserva confirmada para esta clase.',
      });
    }

    return plainToInstance(ReservaClaseOut, resultado.reserva);
  }
}
