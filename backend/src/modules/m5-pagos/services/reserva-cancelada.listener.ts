import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTO_RESERVA_CANCHA_CANCELADA } from '../../../commons/eventos';
import { PagoRepository } from '../repositories/pago.repository';
import { PagosService } from './pagos.service';

export interface EventoReservaCanchaCancelada {
  reservaId: number;
  usuarioId: number;
}

// Puerta de entrada de la anulacion automatica (RF-12/RF-13): M4 emite el evento al
// cancelar una reserva de cancha y M5 anula el pago aprobado (devolucion incluida)
// sin que M4 importe a M5. Si el pago no existe, o esta PENDIENTE/RECHAZADO/ANULADO,
// no hace nada: la anulacion es idempotente.
@Injectable()
export class ReservaCanceladaListener {
  constructor(
    private readonly pagos: PagoRepository,
    private readonly pagosService: PagosService,
  ) {}

  // `suppressErrors: false`: si el reembolso falla, el error se propaga y la
  // cancelacion no se da por buena (mismo criterio que la penalidad de clase).
  @OnEvent(EVENTO_RESERVA_CANCHA_CANCELADA, { suppressErrors: false })
  async onReservaCancelada(datos: EventoReservaCanchaCancelada): Promise<void> {
    const pago = await this.pagos.buscarPorReservaCancha(datos.reservaId);
    if (pago?.estado === 'APROBADO') {
      await this.pagosService.anularPago(pago.id);
    }
  }
}
