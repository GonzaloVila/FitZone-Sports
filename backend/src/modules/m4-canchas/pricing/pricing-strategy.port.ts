import type { InjectionToken } from '@nestjs/common';
import type { PricingContext } from './pricing-context';

export const PRICING_STRATEGY: InjectionToken = 'PRICING_STRATEGY';

export interface PricingStrategy {
  aplicar(precio: number, ctx: PricingContext): number;
}
