import { Injectable } from '@nestjs/common';
import { SOCIO_DESCUENTO_PCT } from './constantes-de-precio';
import type { ContextoDePrecio } from './contexto-de-precio';
import type { ReglaDePrecio } from './regla-de-precio';

// RN-03: solo aplica a un socio con membresia vigente. Un socio con cuota vencida
// (o un externo) no aplica, asi que paga el precio base (de externo). Orden 10.
@Injectable()
export class DescuentoSocio implements ReglaDePrecio {
  aplica(ctx: ContextoDePrecio): boolean {
    return ctx.socioVigente;
  }

  aplicar(precio: number, _ctx: ContextoDePrecio): number {
    return precio * (1 - SOCIO_DESCUENTO_PCT / 100);
  }
}
