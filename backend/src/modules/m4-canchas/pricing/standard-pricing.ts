import type { PricingContext } from './pricing-context';
import type { PricingStrategy } from './pricing-strategy.port';

// Tarifa de externo: precio sin cambios.
export class StandardPricing implements PricingStrategy {
  aplicar(precio: number, _ctx: PricingContext): number {
    return precio;
  }
}
