import { Injectable } from '@nestjs/common';
import { claseNoDisponibleParaReserva } from '../errors/reservas-clases.errors';
import type { ContextoReserva, ValidacionDeReserva } from './validacion-de-reserva';

// Eslabón 4: no se reserva una clase que ya comenzó o terminó.
@Injectable()
export class ClaseNoComenzada implements ValidacionDeReserva {
  validar(ctx: ContextoReserva): void {
    if (!ctx.clase) {
      return; // la garantiza ClaseExiste, que corre antes
    }
    const inicio = ctx.clase.horarioInicio.getTime();
    if (Date.now() >= inicio) {
      throw claseNoDisponibleParaReserva();
    }
  }
}
