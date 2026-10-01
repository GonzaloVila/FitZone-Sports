import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { rangoDelDia } from '../../../commons/fechas';
import {
  ProblemException,
  conflictoDeDominio,
  recursoNoEncontrado,
} from '../../../commons/filters/problem.exception';
import {
  MEMBERSHIP_VALIDATION_PORT,
  MembershipValidationPort,
} from '../../../commons/membresia/membership-validation.port';
import { ReservaCanchaIn } from '../dtos/reserva-cancha-in.dto';
import { ReservaCanchaOut } from '../dtos/reserva-cancha-out.dto';
import { Reserva } from '../entities/reserva.entity';
import { PricingStrategyFactory } from '../pricing/pricing-strategy.factory';
import { CANCHA_REPOSITORY, CanchaRepository } from '../repositories/cancha.repository';
import { RESERVA_REPOSITORY, ReservaRepository } from '../repositories/reserva.repository';

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
    @Inject(RESERVA_REPOSITORY) private readonly reservas: ReservaRepository,
    @Inject(CANCHA_REPOSITORY) private readonly canchas: CanchaRepository,
    // @Optional(): si M1 todavía no registró el adaptador, se cotiza sin
    // descuento de socio en vez de romper el arranque (fail-closed, ADR-09).
    @Optional()
    @Inject(MEMBERSHIP_VALIDATION_PORT)
    private readonly membresias: MembershipValidationPort | null,
    private readonly precios: PricingStrategyFactory,
  ) {}

  async crear(dto: ReservaCanchaIn): Promise<ReservaCanchaOut> {
    const cancha = await this.canchas.buscarPorId(dto.cancha_id);
    if (!cancha) {
      throw recursoNoEncontrado('No existe la cancha indicada.');
    }

    // RF-12: una cancha en mantenimiento no admite turnos nuevos.
    if (cancha.estado === 'EN_MANTENIMIENTO') {
      throw conflictoDeDominio(
        'Cancha en mantenimiento',
        `La cancha ${cancha.id} está en mantenimiento y no admite reservas nuevas (RF-12).`,
      );
    }

    const inicio = new Date(dto.fecha_hora_inicio);
    const fin = new Date(dto.fecha_hora_fin);
    // No se valida contra un horario de apertura/cierre de la sede: ese dato no
    // existe en el modelo (decisión 11 del plan M4, deuda asumida a propósito).
    if (inicio.getTime() >= fin.getTime()) {
      throw new ProblemException({
        type: 'https://fitzone.app/errores/rango-horario-invalido',
        title: 'Rango horario inválido',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: 'fecha_hora_inicio debe ser anterior a fecha_hora_fin.',
      });
    }

    // RN-03: un socio con cuota vencida paga como externo; consultarVigencia
    // también devuelve vigente=false para quien no es socio.
    const vigencia = await this.membresias?.consultarVigencia(dto.usuario_id);
    const socioVigente = vigencia?.vigente ?? false;

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
      // RN-02: el solapamiento lo detecta exq_reserva_turno, no un chequeo previo
      // (que dos reservas simultáneas pasarían las dos).
      throw conflictoDeDominio(
        'Turno ocupado',
        'El turno solicitado ya está ocupado.',
      );
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
      throw this.yaCancelada(id);
    }

    // Baja lógica: exq_reserva_turno excluye las CANCELADA, así que el horario
    // queda libre solo. null acá significa que otra cancelación ganó entre el
    // buscarPorId y este UPDATE: mismo 409.
    const cancelada = await this.reservas.cancelar(id);
    if (!cancelada) {
      throw this.yaCancelada(id);
    }
  }

  private aOut(reserva: Reserva): ReservaCanchaOut {
    return plainToInstance(ReservaCanchaOut, reserva);
  }

  private yaCancelada(id: number): ProblemException {
    return conflictoDeDominio('Reserva ya cancelada', `La reserva ${id} ya estaba cancelada.`);
  }
}
