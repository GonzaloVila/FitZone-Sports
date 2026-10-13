import { describe, expect, it } from 'vitest';
import type { ProblemException } from 'src/commons/filters/problem.exception';
import { CanchaExiste } from 'src/modules/m4-canchas/validaciones/cancha-existe.validacion';
import { CanchaOperativa } from 'src/modules/m4-canchas/validaciones/cancha-operativa.validacion';
import { RangoHorarioValido } from 'src/modules/m4-canchas/validaciones/rango-horario-valido.validacion';
import type {
  ContextoReservaCancha,
  ValidacionDeReservaCancha,
} from 'src/modules/m4-canchas/validaciones/validacion-de-reserva-cancha';
import { ValidadorDeReservasCancha } from 'src/modules/m4-canchas/validaciones/validador-de-reservas-cancha';

// Cadena de validaciones de la reserva de cancha (ADR-10). El solape (RN-02) no es
// un eslabón: lo arbitra la constraint de exclusión en la base.

const canchaOperativa = { id: 1, sedeId: 1, tipo: 'FUTBOL5' as const, costoPorHora: 5000, estado: 'OPERATIVA' as const };

function ctx(over: Partial<ContextoReservaCancha> = {}): ContextoReservaCancha {
  return {
    cancha: canchaOperativa,
    inicio: new Date('2026-11-20T14:00:00-03:00'),
    fin: new Date('2026-11-20T15:00:00-03:00'),
    ...over,
  };
}

function capturar(fn: () => void): ProblemException {
  try {
    fn();
  } catch (e) {
    return e as ProblemException;
  }
  throw new Error('el validador no lanzó');
}

describe('validaciones de reserva de cancha', () => {
  it('CanchaExiste: 404 si la cancha no existe; no lanza si existe', () => {
    expect(capturar(() => new CanchaExiste().validar(ctx({ cancha: null }))).getStatus()).toBe(404);
    expect(() => new CanchaExiste().validar(ctx())).not.toThrow();
  });

  it('CanchaOperativa: 409 si está en mantenimiento; no lanza si está operativa', () => {
    const v = new CanchaOperativa();
    expect(capturar(() => v.validar(ctx({ cancha: { ...canchaOperativa, estado: 'EN_MANTENIMIENTO' } }))).getStatus()).toBe(409);
    expect(() => v.validar(ctx())).not.toThrow();
  });

  it('RangoHorarioValido: 422 si inicio >= fin; no lanza si el rango es válido', () => {
    const v = new RangoHorarioValido();
    const inicio = new Date('2026-11-20T14:00:00-03:00');
    expect(capturar(() => v.validar(ctx({ inicio, fin: inicio }))).getStatus()).toBe(422);
    expect(() => v.validar(ctx())).not.toThrow();
  });

  it('ValidadorDeReservasCancha: recorre en orden y corta en la primera violación', () => {
    const orden: string[] = [];
    const crear = (nombre: string, lanza = false): ValidacionDeReservaCancha => ({
      validar: () => {
        orden.push(nombre);
        if (lanza) throw new Error(nombre);
      },
    });

    const validador = new ValidadorDeReservasCancha([crear('a'), crear('b', true), crear('c')]);
    expect(() => validador.validar(ctx())).toThrow('b');
    expect(orden).toEqual(['a', 'b']);
  });

  it('con las validaciones reales, un contexto válido pasa la cadena entera', () => {
    const validador = new ValidadorDeReservasCancha([
      new CanchaExiste(),
      new CanchaOperativa(),
      new RangoHorarioValido(),
    ]);
    expect(() => validador.validar(ctx())).not.toThrow();
  });
});
