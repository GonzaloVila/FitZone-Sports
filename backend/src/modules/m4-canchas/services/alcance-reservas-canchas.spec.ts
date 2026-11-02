import { describe, expect, it } from 'vitest';
import { cuerpoDe } from '@test/helpers/pagos.fixtures';
import type { UsuarioAutenticado } from 'src/modules/auth/strategies/jwt.strategy';
import {
  DETALLE_NO_EXISTE,
  exigirReservaPropia,
  exigirUsuarioPropio,
  usuarioDelListado,
  veSoloLoPropio,
} from 'src/modules/m4-canchas/services/alcance-reservas-canchas';

const socio: UsuarioAutenticado = { userId: 7, rol: 'SOCIO', socioId: 3 };
const externo: UsuarioAutenticado = { userId: 8, rol: 'EXTERNO' };
const recepcion: UsuarioAutenticado = { userId: 9, rol: 'RECEPCION', sedeId: 1 };
const gerente: UsuarioAutenticado = { userId: 10, rol: 'GERENTE' };

function captar(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('No lanzó nada');
}

describe('alcance de /reservas-canchas', () => {
  it('SOCIO y EXTERNO ven solo lo propio; RECEPCION y GERENTE todo', () => {
    expect(veSoloLoPropio(socio)).toBe(true);
    expect(veSoloLoPropio(externo)).toBe(true);
    expect(veSoloLoPropio(recepcion)).toBe(false);
    expect(veSoloLoPropio(gerente)).toBe(false);
  });

  describe('usuarioDelListado', () => {
    it('SOCIO y EXTERNO fuerzan su userId aunque pidan otro (o ninguno)', () => {
      expect(usuarioDelListado(socio, 99)).toBe(7);
      expect(usuarioDelListado(socio, undefined)).toBe(7);
      expect(usuarioDelListado(externo, 99)).toBe(8);
    });

    it('RECEPCION y GERENTE conservan lo que piden: la grilla lista reservas ajenas', () => {
      expect(usuarioDelListado(recepcion, 99)).toBe(99);
      expect(usuarioDelListado(gerente, undefined)).toBeUndefined();
    });
  });

  describe('exigirUsuarioPropio y exigirReservaPropia', () => {
    it('404 con el texto de "no existe" si el usuario o la reserva son de otro', async () => {
      for (const actor of [socio, externo]) {
        for (const regla of [exigirUsuarioPropio, exigirReservaPropia]) {
          const cuerpo = await cuerpoDe(Promise.reject(captar(() => regla(actor, 55))));

          expect(cuerpo.status).toBe(404);
          expect(cuerpo.detail).toBe(DETALLE_NO_EXISTE);
        }
      }
    });

    it('deja pasar lo propio, y a RECEPCION y GERENTE cualquiera', () => {
      expect(() => exigirUsuarioPropio(socio, 7)).not.toThrow();
      expect(() => exigirReservaPropia(externo, 8)).not.toThrow();
      expect(() => exigirUsuarioPropio(recepcion, 55)).not.toThrow();
      expect(() => exigirReservaPropia(gerente, 55)).not.toThrow();
    });
  });
});
