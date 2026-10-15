import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { EVENTO_CUPO_LIBERADO, EVENTO_RESERVA_CLASE_CANCELADA_TARDIA } from '../../../commons/eventos';
import { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import { ReservaClaseIn } from '../dtos/reserva-clase-in.dto';
import { ListarReservasClaseQueryDto } from '../dtos/listar-reservas-clase-query.dto';
import { ListarReservasDeClaseQueryDto } from '../dtos/listar-reservas-de-clase-query.dto';
import { ReservaClaseOut } from '../dtos/reserva-clase-out.dto';
import { cupoAgotado, reservaDuplicada } from '../errors/reservas-clases.errors';
import { ClaseRepository } from '../repositories/clase.repository';
import { ReservaClaseRepository } from '../repositories/reserva-clase.repository';
import { ValidadorDeReservas } from '../validaciones/validador-de-reservas';

@Injectable()
export class ReservasClasesService {
  constructor(
    private readonly reservasRepo: ReservaClaseRepository,
    private readonly clasesRepo: ClaseRepository,
    // Mismo cambio que en EsperasClasesService: la validación estaba guardada
    // por `if (this.membresias)`, o sea que sin M1 registrado la reserva de
    // clase bonificada pasaba sin comprobar RN-03.
    private readonly membresias: MembresiasService,
    // RF-07: el cobro de la penalidad por cancelación tardía vive en M5 (quien
    // escucha el evento). M3 no puede importar M5 (el grafo es M5 -> M3), así que
    // lo avisa por el bus global, como M1 hace con el cobro de membresía. El mismo
    // bus despacha el cupo liberado (RF-08) a sus oyentes.
    private readonly eventos: EventEmitter2,
    // Cadena de validaciones previas a la reserva (Chain of Responsibility). El
    // service arma el contexto y delega el orden de los chequeos en el validador.
    private readonly validador: ValidadorDeReservas,
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
      { claseId: claseId, estado: filtros.estado },
      { page: filtros.page ?? 1, perPage: filtros.perPage ?? 20 },
    );

    return plainToInstance(ReservaClaseOut, reservas);
  }

  async listarReservasClase(
    filtros: ListarReservasClaseQueryDto,
  ): Promise<ReservaClaseOut[]> {
    const reservas = await this.reservasRepo.listar(
      {
        claseId: filtros.claseId,
        socioId: filtros.socioId,
        estado: filtros.estado,
      },
      { page: filtros.page ?? 1, perPage: filtros.perPage ?? 20 },
    );

    return plainToInstance(ReservaClaseOut, reservas);
  }

  async crearReservaClase(
    claseId: number,
    dto: ReservaClaseIn,
  ): Promise<ReservaClaseOut> {
    const clase = await this.clasesRepo.buscarPorId(claseId);

    // RN-03: la vigencia del socio la lee M1; el validador decide con ese dato.
    const estadoSocio = await this.membresias.consultarVigenciaPorSocio(dto.socioId);

    // Validaciones previas a la reserva (Chain of Responsibility): clase existe,
    // socio al día, ventana de 48 h y clase no comenzada. Corre en orden y corta en
    // la primera violación, con los mismos códigos que antes.
    this.validador.validar({ claseId, socioId: dto.socioId, clase, estadoSocio });

    const resultado = await this.reservasRepo.crearConLock(claseId, dto.socioId);

    if (!resultado.ok) {
      if (resultado.motivo === 'CUPO_AGOTADO') {
        // `clase` está garantizada no-null por el validador ClaseExiste.
        throw cupoAgotado(claseId, clase!.capacidad);
      }

      if (resultado.motivo === 'RESERVA_DUPLICADA') {
        throw reservaDuplicada(dto.socioId, claseId);
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

    const clase = await this.clasesRepo.buscarPorId(reserva.claseId);
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
        reservaClaseId: reserva.id,
        socioId: reserva.socioId,
      });
    }

    await this.reservasRepo.marcarCancelada(reservaClaseId);

    // Disparo del Patrón Observer (RF-08): publica el hecho "se libero un cupo" en
    // el bus y termina. Los oyentes (@OnEvent) reaccionan; este service no los
    // conoce. `emitAsync` (con await) mantiene el aviso dentro del request actual.
    await this.eventos.emitAsync(EVENTO_CUPO_LIBERADO, {
      claseId: reserva.claseId,
      nombreClase: clase.tipo,
      horarioClase: clase.horario,
      socioIdCancelador: reserva.socioId,
      fechaLiberacion: new Date(),
    });
  }
}
