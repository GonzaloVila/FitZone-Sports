import { describe, expect, it } from 'vitest';
import { cuerpoDe } from '@test/helpers/pagos.fixtures';
import type { UsuarioAutenticado } from 'src/modules/auth/strategies/jwt.strategy';
import type { RolAlta, RolUsuario } from 'src/modules/m1-usuarios/entities/usuario.entity';
import {
  DETALLE_NO_EXISTE,
  DETALLE_SOCIO_NO_EXISTE,
  exigirPuedeCrearRol,
  exigirPuedeModificar,
  exigirSocioPropio,
  exigirUsuarioPropio,
  necesitaRolDelObjetivo,
  veSoloLoPropio,
} from 'src/modules/m1-usuarios/services/alcance-usuarios';

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

const falla = (fn: () => void) => cuerpoDe(Promise.reject(captar(fn)));

describe('alcance de /usuarios, /socios y membresías', () => {
  it('SOCIO y EXTERNO ven solo lo propio; RECEPCION y GERENTE todo', () => {
    expect(veSoloLoPropio(socio)).toBe(true);
    expect(veSoloLoPropio(externo)).toBe(true);
    expect(veSoloLoPropio(recepcion)).toBe(false);
    expect(veSoloLoPropio(gerente)).toBe(false);
  });

  describe('exigirPuedeCrearRol', () => {
    it('RECEPCION crea EXTERNO', () => {
      expect(() => exigirPuedeCrearRol(recepcion, 'EXTERNO')).not.toThrow();
    });

    it('403 si RECEPCION intenta crear RECEPCION o GERENTE', async () => {
      for (const rol of ['RECEPCION', 'GERENTE'] as RolAlta[]) {
        const cuerpo = await falla(() => exigirPuedeCrearRol(recepcion, rol));

        expect(cuerpo.status).toBe(403);
        expect(cuerpo.detail).toBe(`Su rol no permite crear usuarios con rol ${rol}.`);
      }
    });

    it('GERENTE crea cualquiera de los roles de alta', () => {
      for (const rol of ['EXTERNO', 'RECEPCION', 'GERENTE'] as RolAlta[]) {
        expect(() => exigirPuedeCrearRol(gerente, rol)).not.toThrow();
      }
    });

    it('SOCIO y EXTERNO no crean ningún rol (el controller ya los frena con 403)', () => {
      expect(() => exigirPuedeCrearRol(socio, 'EXTERNO')).toThrow();
      expect(() => exigirPuedeCrearRol(externo, 'EXTERNO')).toThrow();
    });
  });

  describe('exigirPuedeModificar', () => {
    it('RECEPCION modifica a un SOCIO y a un EXTERNO', () => {
      expect(() => exigirPuedeModificar(recepcion, 20, 'SOCIO')).not.toThrow();
      expect(() => exigirPuedeModificar(recepcion, 21, 'EXTERNO')).not.toThrow();
    });

    it('403 si RECEPCION modifica a un RECEPCION o un GERENTE, incluido él mismo', async () => {
      for (const rol of ['RECEPCION', 'GERENTE'] as RolUsuario[]) {
        const cuerpo = await falla(() => exigirPuedeModificar(recepcion, 22, rol));

        expect(cuerpo.status).toBe(403);
        expect(cuerpo.detail).toBe('Su rol no permite modificar al usuario 22.');
      }
      expect(() => exigirPuedeModificar(recepcion, recepcion.userId, 'RECEPCION')).toThrow();
    });

    it('GERENTE modifica a cualquiera', () => {
      for (const rol of ['SOCIO', 'EXTERNO', 'RECEPCION', 'GERENTE'] as RolUsuario[]) {
        expect(() => exigirPuedeModificar(gerente, 23, rol)).not.toThrow();
      }
    });

    it('solo RECEPCION necesita conocer el rol del objetivo', () => {
      expect(necesitaRolDelObjetivo(recepcion)).toBe(true);
      expect(necesitaRolDelObjetivo(gerente)).toBe(false);
    });
  });

  describe('exigirUsuarioPropio', () => {
    it('404 con el texto de "no existe" si S o E piden otro usuario', async () => {
      for (const actor of [socio, externo]) {
        const cuerpo = await falla(() => exigirUsuarioPropio(actor, 99));

        expect(cuerpo.status).toBe(404);
        expect(cuerpo.detail).toBe(DETALLE_NO_EXISTE);
      }
    });

    it('deja pasar el propio, y a RECEPCION y GERENTE cualquiera', () => {
      expect(() => exigirUsuarioPropio(socio, 7)).not.toThrow();
      expect(() => exigirUsuarioPropio(externo, 8)).not.toThrow();
      expect(() => exigirUsuarioPropio(recepcion, 99)).not.toThrow();
      expect(() => exigirUsuarioPropio(gerente, 99)).not.toThrow();
    });
  });

  describe('exigirSocioPropio', () => {
    it('404 con el texto que se le pasa si el SOCIO pide otro socio', async () => {
      const cuerpo = await falla(() => exigirSocioPropio(socio, 4, DETALLE_SOCIO_NO_EXISTE));

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toBe('No existe el socio indicado.');
    });

    it('el EXTERNO (sin socioId) recibe 404 con cualquier socio', async () => {
      const cuerpo = await falla(() => exigirSocioPropio(externo, 3, DETALLE_NO_EXISTE));

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toBe(DETALLE_NO_EXISTE);
    });

    it('deja pasar el socio propio, y a RECEPCION y GERENTE cualquiera', () => {
      expect(() => exigirSocioPropio(socio, 3, DETALLE_NO_EXISTE)).not.toThrow();
      expect(() => exigirSocioPropio(recepcion, 4, DETALLE_NO_EXISTE)).not.toThrow();
      expect(() => exigirSocioPropio(gerente, 4, DETALLE_NO_EXISTE)).not.toThrow();
    });
  });
});
