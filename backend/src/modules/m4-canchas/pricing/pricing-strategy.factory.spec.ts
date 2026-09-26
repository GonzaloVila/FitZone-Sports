import { describe, expect, it } from 'vitest';
import { PricingContext } from './pricing-context';
import { PricingStrategyFactory } from './pricing-strategy.factory';

// Horarios con offset explícito -03:00 (Buenos Aires no observa horario de
// verano): representan sin ambigüedad la hora local de la sede, sin depender
// del TZ del entorno donde corre el test.
function ctx(parcial: Partial<PricingContext> & Pick<PricingContext, 'inicio' | 'fin'>): PricingContext {
  return {
    costoBase: 5000,
    socioVigente: false,
    ...parcial,
  };
}

describe('PricingStrategyFactory', () => {
  const factory = new PricingStrategyFactory();

  it('externo fuera de pico: sin cambios', () => {
    const precio = factory.cotizar(
      ctx({
        socioVigente: false,
        inicio: new Date('2026-10-01T10:00:00-03:00'),
        fin: new Date('2026-10-01T11:00:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(5000, 5);
  });

  it('socio fuera de pico: 15% de descuento', () => {
    const precio = factory.cotizar(
      ctx({
        socioVigente: true,
        inicio: new Date('2026-10-01T10:00:00-03:00'),
        fin: new Date('2026-10-01T11:00:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(4250, 5);
  });

  it('socio en horario pico: descuento y recargo acumulados (0.85 × 1.20 × 5000)', () => {
    const precio = factory.cotizar(
      ctx({
        socioVigente: true,
        inicio: new Date('2026-10-01T18:00:00-03:00'),
        fin: new Date('2026-10-01T19:30:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(5100, 5);
  });

  it('externo en horario pico: solo recargo (1.20 × 5000, sin descuento)', () => {
    const precio = factory.cotizar(
      ctx({
        socioVigente: false,
        inicio: new Date('2026-10-01T18:00:00-03:00'),
        fin: new Date('2026-10-01T19:30:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(6000, 5);
  });

  it('turno que arranca exactamente a las 21:00: ventana medio-abierta, sin recargo de pico', () => {
    const precio = factory.cotizar(
      ctx({
        socioVigente: true,
        inicio: new Date('2026-10-01T21:00:00-03:00'),
        fin: new Date('2026-10-01T22:00:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(4250, 5);
  });
});
