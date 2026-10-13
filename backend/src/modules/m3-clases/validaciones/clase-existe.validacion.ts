import { Injectable } from '@nestjs/common';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import type { ContextoReserva, ValidacionDeReserva } from './validacion-de-reserva';

// Eslabón 1: la clase reservada tiene que existir.
@Injectable()
export class ClaseExiste implements ValidacionDeReserva {
  validar(ctx: ContextoReserva): void {
    if (!ctx.clase) {
      throw recursoNoEncontrado('No existe la clase indicada.');
    }
  }
}
