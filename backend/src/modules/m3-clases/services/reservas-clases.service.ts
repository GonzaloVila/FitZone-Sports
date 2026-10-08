import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { EVENTO_RESERVA_CLASE_CANCELADA_TARDIA } from '../../../commons/eventos';
import { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import { ReservaClaseIn } from '../dtos/reserva-clase-in.dto';
import { ListarReservasClaseQueryDto } from '../dtos/listar-reservas-clase-query.dto';
import { ListarReservasDeClaseQueryDto } from '../dtos/listar-reservas-de-clase-query.dto';
import { ReservaClaseOut } from '../dtos/reserva-clase-out.dto';
import { CupoLiberadoSubject } from '../observers/cupo-liberado.subject';
import {
  claseNoDisponibleParaReserva,
  cupoAgotado,
  reservaAnticipadaNoPermitida,
  reservaDuplicada,
  socioEnMoraParaReserva,
} from '../errors/reservas-clases.errors';
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
    // RF-07: el cobro de la penalidad por cancelación tardía vive en M5 (quien
    // escucha el evento). M3 no puede importar M5 (el grafo es M5 -> M3), así que
    // lo avisa por el bus global, como M1 hace con el cobro de membresía.
    private readonly eventos: EventEmitter2,
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
      throw socioEnMoraParaReserva(dto.socio_id);
    }

    // Regla de Ventana Temporal (RF-07): reserva habilitada hasta 48 hs antes
    const ahora = Date.now();
    const inicioClase = new Date(clase.horario).getTime();
    const aperturaReserva = inicioClase - 48 * 60 * 60 * 1000;

    if (ahora < aperturaReserva) {
      throw reservaAnticipadaNoPermitida();
    }

    if (ahora >= inicioClase) {
      throw claseNoDisponibleParaReserva();
    }

    const resultado = await this.reservasRepo.crearConLock(claseId, dto.socio_id);

    if (!resultado.ok) {
      if (resultado.motivo === 'CUPO_AGOTADO') {
        throw cupoAgotado(claseId, clase.capacidad);
      }

      if (resultado.motivo === 'RESERVA_DUPLICADA') {
        throw reservaDuplicada(dto.socio_id, claseId);
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

    // Regla de Cancelación (RF-07): SIN penalidad hasta 2 hs antes. Dentro de las
    // 2 hs la cancelación se PERMITE, pero el puesto del socio pierde un porcentaje
    // del valor nominal de la clase, cobrado por M5 antes de liberar el cupo.
    const ahora = Date.now();
    const inicioClase = new Date(clase.horario).getTime();
    const limiteCancelacion = inicioClase - 2 * 60 * 60 * 1000;

    if (ahora > limiteCancelacion) {
      // `emitAsync` es sincrono: si M5 rechaza el cobro de la penalidad (402), el
      // error se propaga aca y la cancelacion NO se aplica (la reserva sigue
      // CONFIRMADA). Es el mismo patron que el cambio de plan de membresia (M1).
      await this.eventos.emitAsync(EVENTO_RESERVA_CLASE_CANCELADA_TARDIA, {
        reserva_clase_id: reserva.id,
        socio_id: reserva.socio_id,
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
