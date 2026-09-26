import type { PricingContext } from './pricing-context';
import type { PricingStrategy } from './pricing-strategy.port';
import { StandardPricing } from './standard-pricing';
import { MemberDiscountPricing } from './member-discount-pricing';
import { PeakHourPricing } from './peak-hour-pricing';

// Orden fijo: descuento de socio y recargo de pico son acumulables, no
// excluyentes entre sí (RF-11).
export class PricingStrategyFactory {
  private readonly estrategias: PricingStrategy[] = [
    new StandardPricing(),
    new MemberDiscountPricing(),
    new PeakHourPricing(),
  ];

  cotizar(ctx: PricingContext): number {
    return this.estrategias.reduce((precio, estrategia) => estrategia.aplicar(precio, ctx), ctx.costoBase);
  }
}
