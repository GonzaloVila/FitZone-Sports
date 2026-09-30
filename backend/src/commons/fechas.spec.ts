import { describe, expect, it } from 'vitest';
import { rangoDelDia, ZONA_SEDE } from './fechas';
import { TIMEZONE_SEDE } from '../modules/m4-canchas/pricing/pricing-constants';

describe('fechas', () => {
  it('exporta la zona horaria de la sede en formato IANA', () => {
    expect(ZONA_SEDE).toBe(TIMEZONE_SEDE);
    expect(ZONA_SEDE).toBe('America/Argentina/Buenos_Aires');
  });

  it('rangoDelDia construye un rango semiabierto [desde, hasta) para el día completo', () => {
    const { desde, hasta } = rangoDelDia('2026-10-01');
    expect(desde.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(hasta.toISOString()).toBe('2026-10-02T03:00:00.000Z');
    expect(hasta.getTime()).toBe(desde.getTime() + 86_400_000);
  });

  it('rechaza fechas inválidas', () => {
    expect(() => rangoDelDia('2026-02-30')).toThrow(RangeError);
    expect(() => rangoDelDia('no-fecha')).toThrow(RangeError);
    expect(() => rangoDelDia('2026-13-01')).toThrow(RangeError);
  });

  it('rechaza un día inexistente en vez de rodarlo al siguiente', () => {
    // Sin el chequeo, new Date('2026-02-30T00:00:00-03:00') no es NaN: rueda
    // solo a 2026-03-02 y el filtro `fecha` devolvería un día que no se pidió.
    expect(() => rangoDelDia('2026-02-30')).toThrow(RangeError);
    expect(() => rangoDelDia('2025-02-29')).toThrow(RangeError);
    expect(rangoDelDia('2024-02-29').desde.toISOString()).toBe('2024-02-29T03:00:00.000Z');
  });

  it('no incluye el inicio del día siguiente en el rango', () => {
    const { desde, hasta } = rangoDelDia('2026-10-01');
    const inicioSiguiente = new Date('2026-10-02T03:00:00.000Z');
    expect(desde < inicioSiguiente).toBe(true);
    expect(hasta.getTime()).toBe(inicioSiguiente.getTime());
  });
});
