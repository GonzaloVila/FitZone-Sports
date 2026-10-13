import { Inject, Injectable } from '@nestjs/common';
import {
  VALIDACIONES_RESERVA,
  type ContextoReserva,
  type ValidacionDeReserva,
} from './validacion-de-reserva';

// Recorre la cadena en orden y corta en la primera violación (el comportamiento
// que ya tenía el service: un error por vez, con su código del contrato).
// La lista la arma el contenedor (ver `useFactory` en clases.module.ts): acá no se
// conoce ninguna validación concreta.
@Injectable()
export class ValidadorDeReservas {
  constructor(
    @Inject(VALIDACIONES_RESERVA) private readonly validaciones: ValidacionDeReserva[],
  ) {}

  validar(ctx: ContextoReserva): void {
    for (const validacion of this.validaciones) {
      validacion.validar(ctx);
    }
  }
}
