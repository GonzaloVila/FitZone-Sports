import { Injectable } from '@nestjs/common';
import { canchaEnMantenimiento } from '../errors/reserva.errors';
import type {
  ContextoReservaCancha,
  ValidacionDeReservaCancha,
} from './validacion-de-reserva-cancha';

// Eslabón 2 (RF-12): una cancha en mantenimiento no admite turnos nuevos. Es un
// 409 con su propio `type`, no el de concurrencia.
@Injectable()
export class CanchaOperativa implements ValidacionDeReservaCancha {
  validar(ctx: ContextoReservaCancha): void {
    if (ctx.cancha?.estado === 'EN_MANTENIMIENTO') {
      throw canchaEnMantenimiento(ctx.cancha.id);
    }
  }
}
