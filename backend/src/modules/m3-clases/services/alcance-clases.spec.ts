import { describe, expect, it } from 'vitest';
import { cuerpoDe } from '@test/helpers/pagos.fixtures';
import type { UsuarioAutenticado } from 'src/modules/auth/strategies/jwt.strategy';
import {
  DETALLE_NO_EXISTE,
  DETALLE_SOCIO_NO_EXISTE,
  esSocio,
  exigirDelSocioPropio,
  exigirSedeDeLaClase,
  exigirSocioDelAlta,
  socioDelListado,
} from 'src/modules/m3-clases/services/alcance-clases';

const socio: UsuarioAutenticado = { userId: 7, rol: 'SOCIO', socioId: 3 };
const socioSinSocioId: UsuarioAutenticado = { userId: 6, rol: 'SOCIO' };
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

describe('alcance de clases, reservas de clase y esperas', () => {
  it('solo el SOCIO se acota a lo propio', () => {
    expect(esSocio(socio)).toBe(true);
    expect(esSocio(recepcion)).toBe(false);
    expect(esSocio(gerente)).toBe(false);
  });

  describe('socioDelListado', () => {
    it('el SOCIO fuerza su socioId aunque pida otro (o ninguno)', () => {
      expect(socioDelListado(socio, 99)).toBe(3);
      expect(socioDelListado(socio, undefined)).toBe(3);
    });

    it('RECEPCION y GERENTE conservan lo que piden', () => {
      expect(socioDelListado(recepcion, 99)).toBe(99);
      expect(socioDelListado(gerente, undefined)).toBeUndefined();
    });

    it('403 si el token del SOCIO no trae socioId: nunca devuelve datos de otros', async () => {
      const cuerpo = await falla(() => socioDelListado(socioSinSocioId, 99));

      expect(cuerpo.status).toBe(403);
    });
  });

  describe('exigirSocioDelAlta', () => {
    it('404 con el texto de "el socio no existe" si el SOCIO manda el socioId de otro', async () => {
      const cuerpo = await falla(() => exigirSocioDelAlta(socio, 4));

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toBe(DETALLE_SOCIO_NO_EXISTE);
    });

    it('403 si el token del SOCIO no trae socioId', async () => {
      const cuerpo = await falla(() => exigirSocioDelAlta(socioSinSocioId, 3));

      expect(cuerpo.status).toBe(403);
    });

    it('deja pasar al SOCIO a su nombre, y a RECEPCION y GERENTE por cualquiera', () => {
      expect(() => exigirSocioDelAlta(socio, 3)).not.toThrow();
      expect(() => exigirSocioDelAlta(recepcion, 4)).not.toThrow();
      expect(() => exigirSocioDelAlta(gerente, 4)).not.toThrow();
    });
  });

  describe('exigirDelSocioPropio', () => {
    it('404 con el texto de "no existe" si la reserva o la espera es de otro socio', async () => {
      const cuerpo = await falla(() => exigirDelSocioPropio(socio, 4));

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toBe(DETALLE_NO_EXISTE);
    });

    it('404 si el token del SOCIO no trae socioId', async () => {
      const cuerpo = await falla(() => exigirDelSocioPropio(socioSinSocioId, 3));

      expect(cuerpo.status).toBe(404);
    });

    it('deja pasar lo propio, y a RECEPCION y GERENTE cualquiera', () => {
      expect(() => exigirDelSocioPropio(socio, 3)).not.toThrow();
      expect(() => exigirDelSocioPropio(recepcion, 4)).not.toThrow();
      expect(() => exigirDelSocioPropio(gerente, 4)).not.toThrow();
    });
  });

  describe('exigirSedeDeLaClase', () => {
    it('403 si RECEPCION crea la clase en otra sede', async () => {
      const cuerpo = await falla(() => exigirSedeDeLaClase(recepcion, 2));

      expect(cuerpo.status).toBe(403);
      expect(cuerpo.detail).toBe('La sede 2 no es la sede de trabajo del recepcionista.');
    });

    it('deja pasar a RECEPCION en su sede y a GERENTE en cualquiera', () => {
      expect(() => exigirSedeDeLaClase(recepcion, 1)).not.toThrow();
      expect(() => exigirSedeDeLaClase(gerente, 2)).not.toThrow();
    });
  });
});
