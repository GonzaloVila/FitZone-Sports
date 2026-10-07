import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { rangoDelDia } from '../../../commons/fechas';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import { ReservaCanchaIn } from '../dtos/reserva-cancha-in.dto';
import { ReservaCanchaOut } from '../dtos/reserva-cancha-out.dto';
import { Reserva } from '../entities/reserva.entity';
import {
  canchaEnMantenimiento,
  rangoHorarioInvalido,
  reservaYaCancelada,
  turnoOcupado,
} from '../errors/reserva.errors';
import { PricingStrategyFactory } from '../pricing/pricing-strategy.factory';
import { CanchaRepository } from '../repositories/cancha.repository';
import { ReservaRepository } from '../domain/reserva.port';

export interface FiltrosListarReservasCanchas {
  canchaId?: number;
  usuarioId?: number;
  estado?: Reserva['estado'];
  fecha?: string;
  page: number;
  perPage: number;
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
    private readonly precios: PricingStrategyFactory,
  ) {}

  async crear(dto: ReservaCanchaIn): Promise<ReservaCanchaOut> {
    const cancha = await this.canchas.buscarPorId(dto.cancha_id);
    if (!cancha) {
      throw recursoNoEncontrado('No existe la cancha indicada.');
    }

    // RF-12: una cancha en mantenimiento no admite turnos nuevos. Es un 409 con
    // su propio `type`, no el de concurrencia: el turno no esta tomado por otro
    // usuario, la cancha esta inhabilitada, y el detail de TurnoOcupado
    // ("Otro usuario reservo el turno... antes que vos") seria falso.
    if (cancha.estado === 'EN_MANTENIMIENTO') {
      throw canchaEnMantenimiento(cancha.id);
    }

    const inicio = new Date(dto.fecha_hora_inicio);
    const fin = new Date(dto.fecha_hora_fin);
    // No se valida contra un horario de apertura/cierre de la sede: ese dato no
    // existe en el modelo (decisión 11 del plan M4, deuda asumida a propósito).
    if (inicio.getTime() >= fin.getTime()) {
      throw rangoHorarioInvalido();
    }

    // RN-03: un socio con cuota vencida paga como externo; consultarVigencia
    // también devuelve vigente=false para quien no es socio.
    const vigencia = await this.membresias.consultarVigencia(dto.usuario_id);
    const socioVigente = vigencia.vigente;

    const precioAplicado = this.precios.cotizar({
      costoBase: cancha.costo_por_hora,
      socioVigente,
      inicio,
      fin,
    });

    const resultado = await this.reservas.crear({
      cancha_id: cancha.id,
      usuario_id: dto.usuario_id,
      fecha_hora_inicio: inicio,
      fecha_hora_fin: fin,
      precio_aplicado: precioAplicado,
    });

    if (!resultado.ok) {
      // RN-02: el solapamiento lo detecta la constraint de exclusion, no un chequeo previo
      // (que dos reservas simultáneas pasarían las dos). El `type` y el `detail`
      // son los que declara el contrato en `ConflictoReservaCancha.turno-ocupado`.
      throw turnoOcupado();
    }

    return this.aOut(resultado.reserva);
  }

  async listar({ fecha, estado, ...resto }: FiltrosListarReservasCanchas): Promise<ReservaCanchaOut[]> {
    // RF-12: las canceladas no aparecen salvo que se pidan explícitas. El
    // default es regla de negocio y vive acá, no en el repositorio.
    // `fecha` se traduce a [desde, hasta) en hora local de la sede (como el
    // filtro de M2) y acota el inicio del turno.
    const rango = fecha !== undefined ? rangoDelDia(fecha) : {};
    const filas = await this.reservas.listar({
      ...resto,
      estado: estado ?? 'CONFIRMADA',
      ...rango,
    });
    return filas.map((reserva) => this.aOut(reserva));
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

    // Baja lógica: la constraint de exclusion excluye las CANCELADA, así que el horario
    // queda libre solo. null acá significa que otra cancelación ganó entre el
    // buscarPorId y este UPDATE: mismo 409.
    const cancelada = await this.reservas.cancelar(id);
    if (!cancelada) {
      throw reservaYaCancelada(id);
    }
  }

  private aOut(reserva: Reserva): ReservaCanchaOut {
    return plainToInstance(ReservaCanchaOut, reserva);
  }
}
