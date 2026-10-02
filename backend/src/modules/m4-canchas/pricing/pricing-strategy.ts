import type { PricingContext } from './pricing-context';

// Contrato del patron Strategy, no un puerto de inyeccion: las tres estrategias
// se arman adentro de PricingStrategyFactory y no se registran como providers,
// asi que no hay token que borrar. El nombre del archivo era `*.port.ts` porque
// en la version hexagonal estas si se resolvian por token; se renombra para que
// el archivo diga lo que hace.
export interface PricingStrategy {
  aplicar(precio: number, ctx: PricingContext): number;
}
