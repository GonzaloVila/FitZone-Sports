import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ProblemException, recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import { ReservaClaseIn } from '../dtos/reserva-clase-in.dto';
import { ListarReservasClaseQueryDto } from '../dtos/listar-reservas-clase-query.dto';
import { ListarReservasDeClaseQueryDto } from '../dtos/listar-reservas-de-clase-query.dto';
import { ReservaClaseOut } from '../dtos/reserva-clase-out.dto';
import { CupoLiberadoSubject } from '../observers/cupo-liberado.subject';
import { ClaseRepository } from '../repositories/clase.repository';
import { ReservaClaseRepository } from '../repositories/reserva-clase.repository';

@Injectable()
export class ReservasClasesService {
  constructor(
    private readonly reservasRepo: ReservaClaseRepository,
    private readonly clasesRepo: ClaseRepository,
    // Mismo cambio que en EsperasClasesService: la validación estaba guardada
    // por `if (this.membresias)`, o sea que sin M1 registrado la reserva de
    // clase bonificada pasaba sin comprobar RN-03.
    private readonly membresias: MembresiasService,
    private readonly cupoSubject: CupoLiberadoSubject,
  ) {}

  async listarReservasDeClase(
    claseId: number,
    filtros: ListarReservasDeClaseQueryDto,
  ): Promise<ReservaClaseOut[]> {
    const clase = await this.clasesRepo.buscarPorId(claseId);
    if (!clase) {
      throw recursoNoEncontrado('No existe la clase indicada.');
    }

    const reservas = await this.reservasRepo.listar(
      { clase_id: claseId, estado: filtros.estado },
      { page: filtros.page ?? 1, perPage: filtros.per_page ?? 20 },
    );

    return plainToInstance(ReservaClaseOut, reservas);
  }

  async listarReservasClase(
    filtros: ListarReservasClaseQueryDto,
  ): Promise<ReservaClaseOut[]> {
    const reservas = await this.reservasRepo.listar(
      {
        clase_id: filtros.clase_id,
        socio_id: filtros.socio_id,
        estado: filtros.estado,
      },
      { page: filtros.page ?? 1, perPage: filtros.per_page ?? 20 },
    );

    return plainToInstance(ReservaClaseOut, reservas);
  }

  async crearReservaClase(
    claseId: number,
    dto: ReservaClaseIn,
  ): Promise<ReservaClaseOut> {
    const clase = await this.clasesRepo.buscarPorId(claseId);
    if (!clase) {
      throw recursoNoEncontrado('No existe la clase indicada.');
    }

    // Regla de Mora y Membresía: el socio con cuota vencida no puede reservar con descuento
    const estado = await this.membresias.consultarVigenciaPorSocio(dto.socio_id);
    if (!estado.esSocio) {
      throw recursoNoEncontrado('El socio indicado no existe.');
    }
    if (estado.enMora || !estado.vigente) {
      throw new ProblemException({
        type: 'https://fitzone.app/errores/socio-en-mora',
        title: 'Socio en mora',
        status: HttpStatus.FORBIDDEN,
        detail: `El socio ${dto.socio_id} posee cuotas vencidas. No puede reservar con tarifa bonificada. Puede abonar el precio de cliente externo.`,
      });
    }

    // Regla de Ventana Temporal (RF-07): reserva habilitada hasta 48 hs antes
    const ahora = Date.now();
    const inicioClase = new Date(clase.horario).getTime();
    const aperturaReserva = inicioClase - 48 * 60 * 60 * 1000;

    if (ahora < aperturaReserva) {
      throw new ProblemException({
        type: 'https://fitzone.app/errores/reserva-anticipada-no-permitida',
        title: 'Reserva anticipada no permitida',
        status: HttpStatus.CONFLICT,
        detail: 'Las reservas de clases solo se habilitan dentro de las 48 horas previas al inicio.',
      });
    }

    if (ahora >= inicioClase) {
      throw new ProblemException({
        type: 'https://fitzone.app/errores/clase-pasada',
        title: 'Clase no disponible',
        status: HttpStatus.CONFLICT,
        detail: 'No es posible reservar una clase que ya comenzó o ha finalizado.',
      });
    }

    const resultado = await this.reservasRepo.crearConLock(claseId, dto.socio_id);

    if (!resultado.ok) {
      if (resultado.motivo === 'CUPO_AGOTADO') {
        throw new ProblemException({
          type: 'https://fitzone.app/errores/cupo-agotado',
          title: 'Cupo de clase agotado',
          status: HttpStatus.CONFLICT,
          detail: `La clase ${claseId} alcanzó su capacidad máxima (${clase.capacidad}). Puede ingresar a la lista de espera (RF-08).`,
        });
      }

      if (resultado.motivo === 'RESERVA_DUPLICADA') {
        throw new ProblemException({
          type: 'https://fitzone.app/errores/reserva-duplicada',
          title: 'Reserva duplicada',
          status: HttpStatus.CONFLICT,
          detail: `El socio ${dto.socio_id} ya posee una reserva confirmada para la clase ${claseId}.`,
        });
      }

      throw recursoNoEncontrado('No existe la clase indicada.');
    }

    return plainToInstance(ReservaClaseOut, resultado.reserva);
  }

  async obtenerReservaClase(reservaClaseId: number): Promise<ReservaClaseOut> {
    const reserva = await this.reservasRepo.buscarPorId(reservaClaseId);
    if (!reserva) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return plainToInstance(ReservaClaseOut, reserva);
  }

  async cancelarReservaClase(reservaClaseId: number): Promise<void> {
    const reserva = await this.reservasRepo.buscarPorId(reservaClaseId);
    if (!reserva) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }

    if (reserva.estado === 'CANCELADA') {
      return;
    }

    const clase = await this.clasesRepo.buscarPorId(reserva.clase_id);
    if (!clase) {
      throw recursoNoEncontrado('No existe la clase vinculada a la reserva.');
    }

    // Regla de Cancelación (RF-07): sin penalidad hasta 2 hs antes
    const ahora = Date.now();
    const inicioClase = new Date(clase.horario).getTime();
    const limiteCancelacion = inicioClase - 2 * 60 * 60 * 1000;

    if (ahora > limiteCancelacion) {
      throw new ProblemException({
        type: 'https://fitzone.app/errores/cancelacion-fuera-de-termino',
        title: 'Cancelación fuera de término',
        status: HttpStatus.CONFLICT,
        detail: 'No es posible cancelar la reserva sin penalidad con menos de 2 horas de anticipación.',
      });
    }

    await this.reservasRepo.marcarCancelada(reservaClaseId);

    // Disparo del Patrón Observer (RF-08): libera lugar y notifica a lista de espera
    await this.cupoSubject.notificar({
      claseId: reserva.clase_id,
      horarioClase: clase.horario,
      socioIdCancelador: reserva.socio_id,
      fechaLiberacion: new Date(),
    });
  }
}
