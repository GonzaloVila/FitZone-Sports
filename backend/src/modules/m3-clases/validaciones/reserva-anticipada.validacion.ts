import { Injectable } from '@nestjs/common';
import { reservaAnticipadaNoPermitida } from '../errors/reservas-clases.errors';
import type { ContextoReserva, ValidacionDeReserva } from './validacion-de-reserva';

// Ventana de reserva (RF-07): solo dentro de las 48 hs previas al inicio.
const VENTANA_RESERVA_MS = 48 * 60 * 60 * 1000;

// Eslabón 3: no se puede reservar con demasiada anticipación.
@Injectable()
export class ReservaAnticipada implements ValidacionDeReserva {
  validar(ctx: ContextoReserva): void {
    if (!ctx.clase) {
      return; // la garantiza ClaseExiste, que corre antes
    }
    const inicio = ctx.clase.horarioInicio.getTime();
    if (Date.now() < inicio - VENTANA_RESERVA_MS) {
      throw reservaAnticipadaNoPermitida();
    }
  }
}
