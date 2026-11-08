import { afterEach, describe, expect, it, vi } from 'vitest';
import { calcularVigencia, PRECIOS_PLAN } from './membresia.entity';

// RF-02: la unica aritmetica de fechas de la membresia. El ancla la elige el llamador: hoy (alta y cambio de plan) o la
// fecha_fin previa (renovacion automatica, para que los periodos queden contiguos).
describe('calcularVigencia (RF-02)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const DESDE = new Date('2026-03-15T12:00:00Z');

  it.each([
    ['MENSUAL', '2026-04-15T12:00:00Z'],
    ['TRIMESTRAL', '2026-06-15T12:00:00Z'],
    ['ANUAL', '2027-03-15T12:00:00Z'],
  ] as const)('el plan %s dura lo que dice', (plan, fin) => {
    expect(calcularVigencia(plan, DESDE)).toEqual({ fechaInicio: DESDE, fechaFin: new Date(fin) });
  });

  it('el periodo arranca exactamente en el ancla y no la modifica', () => {
    const ancla = new Date(DESDE);

    const { fechaInicio } = calcularVigencia('MENSUAL', ancla);

    expect(fechaInicio).toBe(ancla);
    expect(ancla).toEqual(DESDE);
  });

  it('renovar sobre la fecha_fin previa encadena periodos sin huecos ni solapes', () => {
    const primero = calcularVigencia('MENSUAL', DESDE);
    const segundo = calcularVigencia('MENSUAL', primero.fechaFin);

    expect(segundo.fechaInicio).toEqual(primero.fechaFin);
    expect(segundo.fechaFin).toEqual(new Date('2026-05-15T12:00:00Z'));
  });

  it('un periodo trimestral cruza el cambio de año', () => {
    expect(calcularVigencia('TRIMESTRAL', new Date('2026-11-20T12:00:00Z')).fechaFin).toEqual(
      new Date('2027-02-20T12:00:00Z'),
    );
  });

  describe('fin de mes: si el mes destino es mas corto, termina en su ultimo dia (no se desborda al siguiente)', () => {
    it.each([
      ['MENSUAL', '2026-01-31T12:00:00Z', '2026-02-28T12:00:00Z'],
      ['MENSUAL', '2028-01-31T12:00:00Z', '2028-02-29T12:00:00Z'],
      ['MENSUAL', '2026-03-31T12:00:00Z', '2026-04-30T12:00:00Z'],
      ['MENSUAL', '2026-01-30T12:00:00Z', '2026-02-28T12:00:00Z'],
      ['TRIMESTRAL', '2026-11-30T12:00:00Z', '2027-02-28T12:00:00Z'],
      ['TRIMESTRAL', '2026-05-31T12:00:00Z', '2026-08-31T12:00:00Z'],
      ['ANUAL', '2028-02-29T12:00:00Z', '2029-02-28T12:00:00Z'],
    ] as const)('%s desde %s termina el %s', (plan, desde, fin) => {
      expect(calcularVigencia(plan, new Date(desde)).fechaFin).toEqual(new Date(fin));
    });

    it('un dia que existe en el mes destino no se toca', () => {
      expect(calcularVigencia('MENSUAL', new Date('2026-01-28T12:00:00Z')).fechaFin).toEqual(
        new Date('2026-02-28T12:00:00Z'),
      );
    });

    it('conserva la hora del ancla', () => {
      const fin = calcularVigencia('MENSUAL', new Date('2026-01-31T23:15:30.500Z')).fechaFin;
      expect(fin.toISOString()).toBe('2026-02-28T23:15:30.500Z');
    });
  });

  it('sin ancla usa la fecha de hoy', () => {
    vi.useFakeTimers();
    vi.setSystemTime(DESDE);

    expect(calcularVigencia('MENSUAL').fechaInicio).toEqual(DESDE);
  });
});

describe('PRECIOS_PLAN', () => {
  it('los planes mas largos salen mas baratos por mes', () => {
    const porMes = {
      MENSUAL: PRECIOS_PLAN.MENSUAL,
      TRIMESTRAL: PRECIOS_PLAN.TRIMESTRAL / 3,
      ANUAL: PRECIOS_PLAN.ANUAL / 12,
    };

    expect(porMes.TRIMESTRAL).toBeLessThan(porMes.MENSUAL);
    expect(porMes.ANUAL).toBeLessThan(porMes.TRIMESTRAL);
  });
});
