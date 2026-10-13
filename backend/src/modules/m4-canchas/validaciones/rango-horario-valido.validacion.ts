import { Injectable } from '@nestjs/common';
import { rangoHorarioInvalido } from '../errors/reserva.errors';
import type {
  ContextoReservaCancha,
  ValidacionDeReservaCancha,
} from './validacion-de-reserva-cancha';

// Eslabón 3: el inicio tiene que ser anterior al fin.
@Injectable()
export class RangoHorarioValido implements ValidacionDeReservaCancha {
  validar(ctx: ContextoReservaCancha): void {
    if (ctx.inicio.getTime() >= ctx.fin.getTime()) {
      throw rangoHorarioInvalido();
    }
  }
}
