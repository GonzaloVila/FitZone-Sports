import { describe, expect, it } from 'vitest';
import type { ProblemException } from 'src/commons/filters/problem.exception';
import { ClaseExiste } from 'src/modules/m3-clases/validaciones/clase-existe.validacion';
import { ClaseNoComenzada } from 'src/modules/m3-clases/validaciones/clase-no-comenzada.validacion';
import { ReservaAnticipada } from 'src/modules/m3-clases/validaciones/reserva-anticipada.validacion';
import { SocioAlDia } from 'src/modules/m3-clases/validaciones/socio-al-dia.validacion';
import type {
  ContextoReserva,
  ValidacionDeReserva,
} from 'src/modules/m3-clases/validaciones/validacion-de-reserva';
import { ValidadorDeReservas } from 'src/modules/m3-clases/validaciones/validador-de-reservas';

// Cadena de validaciones de la reserva de clase (ADR-10, Chain of Responsibility).
// Los validadores son puros: deciden sobre el contexto ya leído, sin base de datos.

function claseEnHoras(horas: number) {
  return {
    id: 1,
    sedeId: 1,
    tipo: 'Spinning',
    instructor: 'Luca',
    horarioInicio: new Date(Date.now() + horas * 3_600_000),
    capacidad: 10,
  };
}

function ctx(over: Partial<ContextoReserva> = {}): ContextoReserva {
  return {
    claseId: 1,
    socioId: 2,
    clase: claseEnHoras(6),
    estadoSocio: { esSocio: true, vigente: true, enMora: false },
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

function tipoDe(e: ProblemException): string {
  return (e.getResponse() as { type: string }).type;
}

describe('validaciones de reserva de clase', () => {
  it('ClaseExiste: 404 si la clase no existe; no lanza si existe', () => {
    expect(capturar(() => new ClaseExiste().validar(ctx({ clase: null }))).getStatus()).toBe(404);
    expect(() => new ClaseExiste().validar(ctx())).not.toThrow();
  });

  it('SocioAlDia: 404 si no es socio; 403 si está en mora o no vigente', () => {
    const v = new SocioAlDia();
    expect(capturar(() => v.validar(ctx({ estadoSocio: { esSocio: false, vigente: false, enMora: false } }))).getStatus()).toBe(404);
    expect(tipoDe(capturar(() => v.validar(ctx({ estadoSocio: { esSocio: true, vigente: false, enMora: true } }))))).toBe('https://fitzone.app/errores/socio-en-mora');
    expect(capturar(() => v.validar(ctx({ estadoSocio: { esSocio: true, vigente: false, enMora: false } }))).getStatus()).toBe(403);
    expect(() => v.validar(ctx())).not.toThrow();
  });

  it('ReservaAnticipada: 409 si falta más de 48 h; no lanza dentro de la ventana', () => {
    const v = new ReservaAnticipada();
    expect(tipoDe(capturar(() => v.validar(ctx({ clase: claseEnHoras(72) }))))).toBe('https://fitzone.app/errores/reserva-anticipada-no-permitida');
    expect(() => v.validar(ctx({ clase: claseEnHoras(6) }))).not.toThrow();
  });

  it('ClaseNoComenzada: 409 si la clase ya empezó; no lanza si es futura', () => {
    const v = new ClaseNoComenzada();
    expect(tipoDe(capturar(() => v.validar(ctx({ clase: claseEnHoras(-1) }))))).toBe('https://fitzone.app/errores/clase-pasada');
    expect(() => v.validar(ctx({ clase: claseEnHoras(6) }))).not.toThrow();
  });

  it('ValidadorDeReservas: recorre en orden y corta en la primera violación', () => {
    const orden: string[] = [];
    const crear = (nombre: string, lanza = false): ValidacionDeReserva => ({
      validar: () => {
        orden.push(nombre);
        if (lanza) throw new Error(nombre);
      },
    });

    const validador = new ValidadorDeReservas([crear('a'), crear('b', true), crear('c')]);
    expect(() => validador.validar(ctx())).toThrow('b');
    expect(orden).toEqual(['a', 'b']);
  });

  it('con las validaciones reales, un contexto válido pasa la cadena entera', () => {
    const validador = new ValidadorDeReservas([
      new ClaseExiste(),
      new SocioAlDia(),
      new ReservaAnticipada(),
      new ClaseNoComenzada(),
    ]);
    expect(() => validador.validar(ctx())).not.toThrow();
  });
});
