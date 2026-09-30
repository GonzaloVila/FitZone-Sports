import { SOCIO_DESCUENTO_PCT } from './pricing-constants';
import type { PricingContext } from './pricing-context';
import type { PricingStrategy } from './pricing-strategy.port';

// RN-03: un socio con cuota vencida (socioVigente: false) paga precio de externo.
export class MemberDiscountPricing implements PricingStrategy {
  aplicar(precio: number, ctx: PricingContext): number {
    if (!ctx.socioVigente) {
      return precio;
    }
    return precio * (1 - SOCIO_DESCUENTO_PCT / 100);
  }
}
