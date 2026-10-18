import { describe, expect, it } from 'vitest';
import {
  esClienteMovil,
  opcionesBorrarCookieRefresh,
  opcionesCookieRefresh,
  origenPermitido,
} from 'src/modules/auth/refresh-cookie';

const ajustes = { maxAgeSegundos: 604800, sameSite: 'lax' as const, secure: false };

describe('opcionesCookieRefresh', () => {
  it('es HttpOnly, con Path de auth, Max-Age en ms para Express y SameSite/Secure de la config', () => {
    expect(opcionesCookieRefresh(ajustes)).toEqual({
      httpOnly: true,
      path: '/api/v1/auth',
      maxAge: 604800 * 1000,
      sameSite: 'lax',
      secure: false,
    });
    expect(opcionesCookieRefresh({ ...ajustes, sameSite: 'none', secure: true })).toMatchObject({
      sameSite: 'none',
      secure: true,
    });
  });

  it('la de borrado usa las mismas opciones con Max-Age 0', () => {
    expect(opcionesBorrarCookieRefresh(ajustes)).toEqual({ ...opcionesCookieRefresh(ajustes), maxAge: 0 });
  });
});

describe('origenPermitido', () => {
  const permitidos = ['http://localhost:5173', 'https://app.fitzone.test'];

  it('acepta un origen de la lista', () => {
    expect(origenPermitido('http://localhost:5173', permitidos)).toBe(true);
    expect(origenPermitido('https://app.fitzone.test', permitidos)).toBe(true);
  });

  it('rechaza el origen ausente, el no listado, el opaco y las variantes no exactas', () => {
    expect(origenPermitido(undefined, permitidos)).toBe(false);
    expect(origenPermitido('https://evil.test', permitidos)).toBe(false);
    expect(origenPermitido('null', permitidos)).toBe(false);
    expect(origenPermitido('http://localhost:5173/', permitidos)).toBe(false);
    expect(origenPermitido('http://localhost:5174', permitidos)).toBe(false);
    expect(origenPermitido('', permitidos)).toBe(false);
  });

  it('con la lista vacia rechaza todo', () => {
    expect(origenPermitido('http://localhost:5173', [])).toBe(false);
  });
});

describe('esClienteMovil', () => {
  it('solo el valor "movil" (sin distinguir mayusculas ni espacios) activa el canal movil', () => {
    expect(esClienteMovil('movil')).toBe(true);
    expect(esClienteMovil(' Movil ')).toBe(true);
    expect(esClienteMovil(undefined)).toBe(false);
    expect(esClienteMovil('web')).toBe(false);
    expect(esClienteMovil('')).toBe(false);
  });
});
