import { describe, expect, it } from 'vitest';
import { estadoDeReserva } from 'src/modules/m4-canchas/domain/reserva-estado';
import type { Reserva } from 'src/modules/m4-canchas/entities/reserva.entity';

// Turno 19:00-20:00 con offset explicito -03:00 (hora local de la sede).
function reserva(parcial: Partial<Reserva> = {}): Reserva {
  return {
    id: 1,
    canchaId: 1,
    usuarioId: 1,
    fechaHoraInicio: new Date('2026-10-01T19:00:00-03:00'),
    fechaHoraFin: new Date('2026-10-01T20:00:00-03:00'),
    estado: 'CONFIRMADA',
    precioAplicado: 5000,
    ...parcial,
  };
}

const antes = new Date('2026-10-01T18:00:00-03:00');
const enCurso = new Date('2026-10-01T19:30:00-03:00');
const despues = new Date('2026-10-01T20:30:00-03:00');

describe('estadoDeReserva (State derivado, ADR-10)', () => {
  it('antes de empezar: CONFIRMADA y cancelable', () => {
    const r = reserva();
    expect(estadoDeReserva(r, antes).nombre).toBe('CONFIRMADA');
    expect(estadoDeReserva(r, antes).puedeCancelar(r, antes)).toBe(true);
  });

  it('despues del fin: CUMPLIDA (derivada de la fecha, no persistida) y NO cancelable', () => {
    const r = reserva(); // la columna sigue CONFIRMADA
    expect(r.estado).toBe('CONFIRMADA');
    expect(estadoDeReserva(r, despues).nombre).toBe('CUMPLIDA');
    expect(estadoDeReserva(r, despues).puedeCancelar(r, despues)).toBe(false);
  });

  it('en curso: sigue CONFIRMADA pero NO cancelable (el turno ya empezo)', () => {
    const r = reserva();
    expect(estadoDeReserva(r, enCurso).nombre).toBe('CONFIRMADA');
    expect(estadoDeReserva(r, enCurso).puedeCancelar(r, enCurso)).toBe(false);
  });

  it('CANCELADA gana sobre la fecha', () => {
    const r = reserva({ estado: 'CANCELADA' });
    expect(estadoDeReserva(r, antes).nombre).toBe('CANCELADA');
    expect(estadoDeReserva(r, antes).puedeCancelar(r, antes)).toBe(false);
  });
});
