import { Inject, Injectable } from '@nestjs/common';
import type { ContextoDePrecio } from './contexto-de-precio';
import { REGLAS_DE_PRECIO, type ReglaDePrecio } from './regla-de-precio';

// Context del patron (la catedra lo llama Tarifador): recorre la coleccion ordenada
// de reglas, se queda con las que aplican (aplica) y las reduce sobre el precio base
// (aplicar). Como las reglas se ACUMULAN, la cadena es una cadena de decoradores
// armada por el contenedor: el orden lo fija el `useFactory` del modulo (el @Order
// de Spring). La lista se inyecta: la clase no conoce ninguna regla concreta.
@Injectable()
export class TarifadorDePrecios {
  constructor(
    @Inject(REGLAS_DE_PRECIO) private readonly reglas: ReglaDePrecio[],
  ) {}

  cotizar(ctx: ContextoDePrecio): number {
    return this.reglas
      .filter((regla) => regla.aplica(ctx))
      .reduce((precio, regla) => regla.aplicar(precio, ctx), ctx.costoBase);
  }
}
