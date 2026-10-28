import { describe, expect, it } from 'vitest';
import { capitalizar, etiquetaDelPlan, textoDelEstado } from 'src/modules/m5-pagos/services/comprobantes.estilo';

describe('etiquetaDelPlan', () => {
  it.each([
    ['MENSUAL', 'Mensual'],
    ['TRIMESTRAL', 'Trimestral'],
    ['ANUAL', 'Anual'],
  ])('%s se imprime como "%s"', (plan, esperado) => {
    expect(etiquetaDelPlan(plan)).toBe(esperado);
  });

  it('un plan que se agregue mañana sale bien sin tocar nada', () => {
    expect(etiquetaDelPlan('SEMESTRAL')).toBe('Semestral');
  });
});

describe('capitalizar', () => {
  it('primera letra en mayúscula y el resto en minúscula', () => {
    expect(capitalizar('APROBADO')).toBe('Aprobado');
    expect(capitalizar('aprobado')).toBe('Aprobado');
    expect(capitalizar('')).toBe('');
  });
});

describe('textoDelEstado', () => {
  it.each([
    ['APROBADO', 'Estado: Aprobado'],
    ['PENDIENTE', 'Estado: Pendiente'],
    ['RECHAZADO', 'Estado: Rechazado'],
    ['ANULADO', 'Estado: Anulado'],
  ] as const)('%s se imprime como "%s"', (estado, esperado) => {
    expect(textoDelEstado(estado)).toBe(esperado);
  });
});
