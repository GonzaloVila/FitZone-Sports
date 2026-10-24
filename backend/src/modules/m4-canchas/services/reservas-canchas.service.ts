import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { EVENTO_RESERVA_CANCHA_CANCELADA } from '../../../commons/eventos';
import { rangoDelDia } from '../../../commons/fechas';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import { ReservaCanchaIn } from '../dtos/reserva-cancha-in.dto';
import { ReservaCanchaOut } from '../dtos/reserva-cancha-out.dto';
import { Reserva } from '../entities/reserva.entity';
import { estadoDeReserva, type EstadoReservaDerivado } from '../domain/reserva-estado';
import { reservaPasada, reservaYaCancelada, turnoOcupado } from '../errors/reserva.errors';
import { TarifadorDePrecios } from '../pricing/tarifador-de-precios';
import { CanchaRepository } from '../repositories/cancha.repository';
import { ReservaRepository } from '../domain/reserva.port';
import { ValidadorDeReservasCancha } from '../validaciones/validador-de-reservas-cancha';

export interface FiltrosListarReservasCanchas {
  canchaId?: number;
  usuarioId?: number;
  estado?: EstadoReservaDerivado;
  fecha?: string;
  page: number;
  perPage: number;
}

// Traduce el estado EFECTIVO pedido (que puede ser CUMPLIDA, valor que no vive en
// la columna) al filtro persistido + el rango de `fecha_hora_fin` que lo distingue.
function traducirFiltroDeEstado(
  estado: EstadoReservaDerivado | undefined,
  ahora: Date,
): { estado: Reserva['estado']; finDesde?: Date; finHasta?: Date } {
  if (estado === 'CANCELADA') {
    return { estado: 'CANCELADA' };
  }
  if (estado === 'CUMPLIDA') {
    return { estado: 'CONFIRMADA', finHasta: ahora }; // fin < ahora
  }
  // CONFIRMADA (o default): solo las activas (fin >= ahora).
  return { estado: 'CONFIRMADA', finDesde: ahora };
}

@Injectable()
export class ReservasCanchasService {
  constructor(
    private readonly reservas: ReservaRepository,
    private readonly canchas: CanchaRepository,
    // El `@Optional()` era fail-closed: sin el puerto, la reserva se cotizaba
    // sin descuento. Con la dependencia obligatoria el precio bonificado depende
    // siempre de la vigencia real de la membresía (RN-03, ADR-09).
    private readonly membresias: MembresiasService,
    private readonly precios: TarifadorDePrecios,
    // Cadena de validaciones previas a la reserva (Chain of Responsibility).
    private readonly validador: ValidadorDeReservasCancha,
    // Bus de eventos: M5 escucha la cancelacion para anular el pago aprobado.
    private readonly eventos: EventEmitter2,
  ) {}

  async crear(dto: ReservaCanchaIn): Promise<ReservaCanchaOut> {
    const cancha = await this.canchas.buscarPorId(dto.canchaId);
    const inicio = new Date(dto.fechaHoraInicio);
    const fin = new Date(dto.fechaHoraFin);

    // Validaciones previas (Chain of Responsibility): cancha existe, cancha
    // operativa (RF-12) y rango horario válido. El solape (RN-02) no es un eslabón:
    // lo arbitra la constraint de exclusión en la base.
    this.validador.validar({ cancha, inicio, fin });

    // RN-03: un socio con cuota vencida paga como externo; consultarVigencia
    // también devuelve vigente=false para quien no es socio.
    const vigencia = await this.membresias.consultarVigencia(dto.usuarioId);
    const socioVigente = vigencia.vigente;

    // `cancha` está garantizada no-null por el validador CanchaExiste.
    const precioAplicado = this.precios.cotizar({
      costoBase: cancha!.costoPorHora,
      socioVigente,
      inicio,
      fin,
    });

    const resultado = await this.reservas.crear({
      canchaId: cancha!.id,
      usuarioId: dto.usuarioId,
      fechaHoraInicio: inicio,
      fechaHoraFin: fin,
      precioAplicado: precioAplicado,
    });

    if (!resultado.ok) {
      // RN-02: el solapamiento lo detecta la constraint de exclusion, no un chequeo previo
      // (que dos reservas simultáneas pasarían las dos). El `type` y el `detail`
      // son los que declara el contrato en `ConflictoReservaCancha.turno-ocupado`.
      throw turnoOcupado();
    }

    return this.aOut(resultado.reserva);
  }

  async listar({ fecha, estado, ...resto }: FiltrosListarReservasCanchas): Promise<{ items: ReservaCanchaOut[]; total: number }> {
    // RF-12: las canceladas no aparecen salvo que se pidan explícitas. El default
    // es regla de negocio y vive acá, no en el repositorio. `fecha` se traduce a
    // [desde, hasta) en hora local de la sede y acota el inicio del turno.
    //
    // El estado pedido es el EFECTIVO (derivado): CUMPLIDA no está en la columna,
    // así que se traduce a `CONFIRMADA` con `fecha_hora_fin` pasada; y el default
    // (o CONFIRMADA) es `CONFIRMADA` con `fecha_hora_fin` futura (las "activas").
    const ahora = new Date();
    const { estado: estadoPersistido, finDesde, finHasta } = traducirFiltroDeEstado(estado, ahora);
    const rango = fecha !== undefined ? rangoDelDia(fecha) : {};
    const { items, total } = await this.reservas.listar({
      ...resto,
      estado: estadoPersistido,
      finDesde,
      finHasta,
      ...rango,
    });
    return {
      items: items.map((reserva) => this.aOut(reserva)),
      total,
    };
  }

  async obtener(id: number): Promise<ReservaCanchaOut> {
    const reserva = await this.reservas.buscarPorId(id);
    if (!reserva) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(reserva);
  }

  async cancelar(id: number): Promise<void> {
    const reserva = await this.reservas.buscarPorId(id);
    if (!reserva) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    if (reserva.estado === 'CANCELADA') {
      throw reservaYaCancelada(id);
    }

    // El turno ya empezó (o pasó): la reserva es, efectivamente, CUMPLIDA. No se
    // cancela lo que ya ocurrió (ver domain/reserva-estado.ts).
    if (!estadoDeReserva(reserva).puedeCancelar(reserva)) {
      throw reservaPasada(id);
    }

    // Baja lógica: la constraint de exclusion excluye las CANCELADA, así que el horario
    // queda libre solo. null acá significa que otra cancelación ganó entre el
    // buscarPorId y este UPDATE: mismo 409.
    const cancelada = await this.reservas.cancelar(id);
    if (!cancelada) {
      throw reservaYaCancelada(id);
    }

    // M5 anula el pago aprobado (RF-12/RF-13). Va despues del commit de la
    // cancelacion: si el reembolso falla, el error sube y el pago queda ANULADO.
    await this.eventos.emitAsync(EVENTO_RESERVA_CANCHA_CANCELADA, {
      reservaId: id,
      usuarioId: reserva.usuarioId,
    });
  }

  private aOut(reserva: Reserva): ReservaCanchaOut {
    const out = plainToInstance(ReservaCanchaOut, reserva);
    // La API muestra el estado EFECTIVO (derivado): una reserva pasada sale
    // como CUMPLIDA aunque la columna siga diciendo CONFIRMADA.
    out.estado = estadoDeReserva(reserva).nombre;
    return out;
  }
}
