import { Injectable } from '@nestjs/common';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import type {
  ContextoReservaCancha,
  ValidacionDeReservaCancha,
} from './validacion-de-reserva-cancha';

// Eslabón 1: la cancha reservada tiene que existir.
@Injectable()
export class CanchaExiste implements ValidacionDeReservaCancha {
  validar(ctx: ContextoReservaCancha): void {
    if (!ctx.cancha) {
      throw recursoNoEncontrado('No existe la cancha indicada.');
    }
  }
}
