import { Inject, Injectable } from '@nestjs/common';
import {
  VALIDACIONES_RESERVA_CANCHA,
  type ContextoReservaCancha,
  type ValidacionDeReservaCancha,
} from './validacion-de-reserva-cancha';

// Recorre la cadena en orden y corta en la primera violación (mismos códigos que
// antes). La lista la arma el contenedor (ver `useFactory` en canchas.module.ts).
@Injectable()
export class ValidadorDeReservasCancha {
  constructor(
    @Inject(VALIDACIONES_RESERVA_CANCHA)
    private readonly validaciones: ValidacionDeReservaCancha[],
  ) {}

  validar(ctx: ContextoReservaCancha): void {
    for (const validacion of this.validaciones) {
      validacion.validar(ctx);
    }
  }
}
