import { Injectable } from '@nestjs/common';
import { turnoPasado } from '../errors/reserva.errors';
import type {
  ContextoReservaCancha,
  ValidacionDeReservaCancha,
} from './validacion-de-reserva-cancha';

// Eslabón 4: el turno tiene que empezar en el futuro. Un turno ya empezado no se
// puede reservar (y si se dejaba, nacía CUMPLIDA porque el estado se deriva del fin).
@Injectable()
export class TurnoNoPasado implements ValidacionDeReservaCancha {
  validar(ctx: ContextoReservaCancha): void {
    if (ctx.inicio.getTime() <= Date.now()) {
      throw turnoPasado();
    }
  }
}
