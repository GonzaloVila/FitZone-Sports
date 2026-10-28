import { describe, expect, it } from 'vitest';
import { cuerpoDe } from '@test/helpers/pagos.fixtures';
import type { UsuarioAutenticado } from 'src/modules/auth/strategies/jwt.strategy';
import {
  detalleConceptoInexistente,
  exigirConceptoPropio,
  exigirPagoPropio,
  usuarioDelListado,
  veSoloLoPropio,
} from 'src/modules/m5-pagos/services/alcance-pagos';

const socio: UsuarioAutenticado = { userId: 7, rol: 'SOCIO', socioId: 3 };
const externo: UsuarioAutenticado = { userId: 8, rol: 'EXTERNO' };
const recepcion: UsuarioAutenticado = { userId: 9, rol: 'RECEPCION', sedeId: 1 };
const gerente: UsuarioAutenticado = { userId: 10, rol: 'GERENTE' };

describe('alcance de /pagos', () => {
  it('SOCIO y EXTERNO ven solo lo propio; RECEPCION y GERENTE todo', () => {
    expect(veSoloLoPropio(socio)).toBe(true);
    expect(veSoloLoPropio(externo)).toBe(true);
    expect(veSoloLoPropio(recepcion)).toBe(false);
    expect(veSoloLoPropio(gerente)).toBe(false);
  });

  describe('usuarioDelListado', () => {
    it('SOCIO y EXTERNO fuerzan su usuarioId aunque pidan otro (o ninguno)', () => {
      expect(usuarioDelListado(socio, 99)).toBe(7);
      expect(usuarioDelListado(socio, undefined)).toBe(7);
      expect(usuarioDelListado(externo, 99)).toBe(8);
    });

    it('RECEPCION y GERENTE conservan lo que piden', () => {
      expect(usuarioDelListado(recepcion, 99)).toBe(99);
      expect(usuarioDelListado(gerente, undefined)).toBeUndefined();
    });
  });

  describe('exigirPagoPropio', () => {
    it('404 con el texto de "no existe" si el pago es de otro usuario', async () => {
      const cuerpo = await cuerpoDe(Promise.reject(captar(() => exigirPagoPropio(socio, 55, 12))));

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toBe('No existe el pago 12.');
    });

    it('deja pasar el pago propio', () => {
      expect(() => exigirPagoPropio(socio, 7, 12)).not.toThrow();
      expect(() => exigirPagoPropio(externo, 8, 12)).not.toThrow();
    });

    it('RECEPCION y GERENTE acceden a cualquier pago', () => {
      expect(() => exigirPagoPropio(recepcion, 55, 12)).not.toThrow();
      expect(() => exigirPagoPropio(gerente, 55, 12)).not.toThrow();
    });
  });

  describe('exigirConceptoPropio', () => {
    const conceptos = [
      { tipo: 'RESERVA_CANCHA', reservaCanchaId: 4 },
      { tipo: 'MEMBRESIA', membresiaId: 5 },
      { tipo: 'RESERVA_CLASE', reservaClaseId: 6 },
    ] as const;

    it('404 para un concepto ajeno, con el mismo texto que un concepto inexistente', async () => {
      for (const concepto of conceptos) {
        const cuerpo = await cuerpoDe(Promise.reject(captar(() => exigirConceptoPropio(externo, 55, concepto))));

        expect(cuerpo.status).toBe(404);
        expect(cuerpo.detail).toBe(detalleConceptoInexistente(concepto));
      }
    });

    it('los textos de inexistente son los que usa PagosService', () => {
      expect(detalleConceptoInexistente(conceptos[0])).toBe('No existe la reserva 4.');
      expect(detalleConceptoInexistente(conceptos[1])).toBe('No existe la membresía 5.');
      expect(detalleConceptoInexistente(conceptos[2])).toBe('No existe la reserva de clase 6.');
    });

    it('deja pasar el concepto propio y a RECEPCION y GERENTE cualquiera', () => {
      expect(() => exigirConceptoPropio(socio, 7, conceptos[0])).not.toThrow();
      expect(() => exigirConceptoPropio(recepcion, 55, conceptos[1])).not.toThrow();
      expect(() => exigirConceptoPropio(gerente, 55, conceptos[2])).not.toThrow();
    });
  });
});

// Devuelve lo que lanza la funcion (o falla el test si no lanza).
function captar(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que lanzara.');
}
