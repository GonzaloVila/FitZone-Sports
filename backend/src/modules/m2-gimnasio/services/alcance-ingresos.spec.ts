import { describe, expect, it } from 'vitest';
import { cuerpoDe } from '@test/helpers/pagos.fixtures';
import type { UsuarioAutenticado } from 'src/modules/auth/strategies/jwt.strategy';
import {
  exigirIngresoDeSuSede,
  exigirSedePropia,
  recepcionFueraDeSede,
} from 'src/modules/m2-gimnasio/services/alcance-ingresos';

const recepcion: UsuarioAutenticado = { userId: 9, rol: 'RECEPCION', sedeId: 1 };
const recepcionSinSede: UsuarioAutenticado = { userId: 11, rol: 'RECEPCION' };
const gerente: UsuarioAutenticado = { userId: 10, rol: 'GERENTE' };

function captar(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('No lanzó nada');
}

describe('alcance por sede de M2', () => {
  describe('recepcionFueraDeSede', () => {
    it('RECEPCION solo coincide con su sede', () => {
      expect(recepcionFueraDeSede(recepcion, 1)).toBe(false);
      expect(recepcionFueraDeSede(recepcion, 2)).toBe(true);
    });

    it('RECEPCION sin sede asignada queda afuera de todas', () => {
      expect(recepcionFueraDeSede(recepcionSinSede, 1)).toBe(true);
    });

    it('GERENTE no tiene restricción de sede', () => {
      expect(recepcionFueraDeSede(gerente, 1)).toBe(false);
      expect(recepcionFueraDeSede(gerente, 99)).toBe(false);
    });
  });

  describe('exigirSedePropia', () => {
    it('403 si RECEPCION pide otra sede', async () => {
      const cuerpo = await cuerpoDe(Promise.reject(captar(() => exigirSedePropia(recepcion, 2))));

      expect(cuerpo.status).toBe(403);
      expect(cuerpo.detail).toBe('La sede 2 no es la sede de trabajo del recepcionista.');
    });

    it('deja pasar a RECEPCION en su sede y a GERENTE en cualquiera', () => {
      expect(() => exigirSedePropia(recepcion, 1)).not.toThrow();
      expect(() => exigirSedePropia(gerente, 2)).not.toThrow();
    });
  });

  describe('exigirIngresoDeSuSede', () => {
    it('403 con el mismo texto del egreso si el ingreso es de otra sede', async () => {
      const cuerpo = await cuerpoDe(Promise.reject(captar(() => exigirIngresoDeSuSede(recepcion, 15, 2))));

      expect(cuerpo.status).toBe(403);
      expect(cuerpo.detail).toBe('El ingreso 15 no pertenece a la sede del recepcionista.');
    });

    it('deja pasar el ingreso de su sede y a GERENTE en cualquiera', () => {
      expect(() => exigirIngresoDeSuSede(recepcion, 15, 1)).not.toThrow();
      expect(() => exigirIngresoDeSuSede(gerente, 15, 2)).not.toThrow();
    });
  });
});
