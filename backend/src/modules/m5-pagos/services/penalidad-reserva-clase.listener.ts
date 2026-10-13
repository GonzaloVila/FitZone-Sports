import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTO_RESERVA_CLASE_CANCELADA_TARDIA } from '../../../commons/eventos';
import { PenalidadReservaClaseService } from './penalidad-reserva-clase.service';

// Puerta de entrada del cobro interno de la penalidad de clase (RF-07).
//
// M3 emite este evento al cancelar una reserva con < 2 hs de anticipación, y M5
// cobra SIN que M3 importe a M5 (el grafo es M5 → M3, sin ciclos). El bus es
// global y síncrono, y M3 usa `emitAsync` para esperar el resultado del listener:
// si acá se lanza (cobro rechazado), el error se propaga al emisor y la
// cancelación no se aplica.

export interface EventoCancelacionTardia {
  reservaClaseId: number;
  socioId: number;
}

@Injectable()
export class PenalidadReservaClaseListener {
  constructor(private readonly penalidades: PenalidadReservaClaseService) {}

  // `suppressErrors: false`: el default de @nestjs/event-emitter es tragar el error
  // del listener, con lo que un cobro rechazado (402) no llegaría a M3 y la
  // cancelación se aplicaría igual. Con `false` el rechazo propaga y no cancela.
  @OnEvent(EVENTO_RESERVA_CLASE_CANCELADA_TARDIA, { suppressErrors: false })
  async onCancelacionTardia(datos: EventoCancelacionTardia): Promise<void> {
    // La clave es determinista: reintentar el mismo evento no cobra dos veces.
    await this.penalidades.cobrarPenalidad(
      { reservaClaseId: datos.reservaClaseId },
      `penalidad-clase-${datos.reservaClaseId}`,
    );
  }
}