import { describe, expect, it } from 'vitest';
import { leerCookie } from './cookies';

describe('leerCookie', () => {
  it('lee la cookie pedida entre varias', () => {
    expect(leerCookie('a=1; refresh_token=xyz; b=2', 'refresh_token')).toBe('xyz');
    expect(leerCookie('refresh_token=xyz', 'refresh_token')).toBe('xyz');
  });

  it('conserva los "=" del valor (base64) y decodifica el percent-encoding', () => {
    expect(leerCookie('refresh_token=ab=c', 'refresh_token')).toBe('ab=c');
    expect(leerCookie('refresh_token=a%20b', 'refresh_token')).toBe('a b');
  });

  it('con un percent-encoding invalido devuelve el valor crudo', () => {
    expect(leerCookie('refresh_token=%E0%A4%A', 'refresh_token')).toBe('%E0%A4%A');
  });

  it('no confunde cookies cuyo nombre solo termina o empieza igual', () => {
    expect(leerCookie('x_refresh_token=1; refresh_token_2=2', 'refresh_token')).toBeUndefined();
  });

  it('devuelve undefined si falta el header, la cookie o su valor', () => {
    expect(leerCookie(undefined, 'refresh_token')).toBeUndefined();
    expect(leerCookie('', 'refresh_token')).toBeUndefined();
    expect(leerCookie('otra=1', 'refresh_token')).toBeUndefined();
    expect(leerCookie('refresh_token=', 'refresh_token')).toBeUndefined();
    expect(leerCookie('refresh_token', 'refresh_token')).toBeUndefined();
  });
});
