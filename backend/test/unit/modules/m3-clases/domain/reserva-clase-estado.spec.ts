import { describe, expect, it } from 'vitest';
import { estadoDeReservaClase } from 'src/modules/m3-clases/domain/reserva-clase-estado';
import type { ReservaClase } from 'src/modules/m3-clases/entities/reserva-clase.entity';

// Clase 19:00-20:00 con offset explicito -03:00 (hora local de la sede).
function reserva(parcial: Partial<ReservaClase> = {}): ReservaClase {
  return {
    id: 1,
    claseId: 1,
    socioId: 1,
    estado: 'CONFIRMADA',
    horarioInicio: new Date('2026-10-01T19:00:00-03:00'),
    horarioFin: new Date('2026-10-01T20:00:00-03:00'),
    ...parcial,
  };
}

const antes = new Date('2026-10-01T18:00:00-03:00');
const enCurso = new Date('2026-10-01T19:30:00-03:00');
const despues = new Date('2026-10-01T20:30:00-03:00');

describe('estadoDeReservaClase (State derivado, ADR-10)', () => {
  it('antes de empezar: CONFIRMADA y cancelable', () => {
    const r = reserva();
    expect(estadoDeReservaClase(r, antes).nombre).toBe('CONFIRMADA');
    expect(estadoDeReservaClase(r, antes).puedeCancelar(r, antes)).toBe(true);
  });

  it('despues del fin: CUMPLIDA (derivada de la fecha) y NO cancelable', () => {
    const r = reserva(); // la columna sigue CONFIRMADA
    expect(r.estado).toBe('CONFIRMADA');
    expect(estadoDeReservaClase(r, despues).nombre).toBe('CUMPLIDA');
    expect(estadoDeReservaClase(r, despues).puedeCancelar(r, despues)).toBe(false);
  });

  it('en curso: sigue CONFIRMADA pero NO cancelable (la clase ya empezo)', () => {
    const r = reserva();
    expect(estadoDeReservaClase(r, enCurso).nombre).toBe('CONFIRMADA');
    expect(estadoDeReservaClase(r, enCurso).puedeCancelar(r, enCurso)).toBe(false);
  });

  it('CANCELADA gana sobre la fecha', () => {
    const r = reserva({ estado: 'CANCELADA' });
    expect(estadoDeReservaClase(r, antes).nombre).toBe('CANCELADA');
    expect(estadoDeReservaClase(r, antes).puedeCancelar(r, antes)).toBe(false);
  });
});
