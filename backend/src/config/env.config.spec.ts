import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.config';

const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('validateEnv: sesion con refresh token', () => {
  it('aplica los defaults: access 15 min, refresh 7 dias, CORS de Vite, SameSite lax y Secure false fuera de produccion', () => {
    const env = validateEnv(base);
    expect(env.JWT_EXPIRES_IN).toBe(900);
    expect(env.REFRESH_EXPIRES_IN).toBe(604800);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.REFRESH_COOKIE_SAMESITE).toBe('lax');
    expect(env.REFRESH_COOKIE_SECURE).toBe(false);
  });

  it('Secure es true por defecto solo en production', () => {
    expect(validateEnv({ ...base, NODE_ENV: 'production' }).REFRESH_COOKIE_SECURE).toBe(true);
    expect(validateEnv({ ...base, NODE_ENV: 'test' }).REFRESH_COOKIE_SECURE).toBe(false);
  });

  it('un Secure explicito manda sobre el default, y "false" no se interpreta como true', () => {
    expect(validateEnv({ ...base, NODE_ENV: 'production', REFRESH_COOKIE_SECURE: 'false' }).REFRESH_COOKIE_SECURE).toBe(false);
    expect(validateEnv({ ...base, REFRESH_COOKIE_SECURE: 'true' }).REFRESH_COOKIE_SECURE).toBe(true);
  });

  it('CORS_ORIGINS se separa por coma, recorta espacios y descarta vacios', () => {
    const env = validateEnv({ ...base, CORS_ORIGINS: 'http://a.test, https://b.test ,,' });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'https://b.test']);
  });

  it("SameSite 'none' sin Secure falla al arrancar con un mensaje claro", () => {
    expect(() => validateEnv({ ...base, REFRESH_COOKIE_SAMESITE: 'none' })).toThrow(
      /REFRESH_COOKIE_SECURE.*REFRESH_COOKIE_SAMESITE='none' exige REFRESH_COOKIE_SECURE=true/,
    );
    expect(() =>
      validateEnv({ ...base, REFRESH_COOKIE_SAMESITE: 'none', REFRESH_COOKIE_SECURE: 'false', NODE_ENV: 'production' }),
    ).toThrow(/exige REFRESH_COOKIE_SECURE=true/);
  });

  it("SameSite 'none' con Secure explicito o en production es valido", () => {
    expect(validateEnv({ ...base, REFRESH_COOKIE_SAMESITE: 'none', REFRESH_COOKIE_SECURE: 'true' }).REFRESH_COOKIE_SECURE).toBe(true);
    expect(validateEnv({ ...base, REFRESH_COOKIE_SAMESITE: 'none', NODE_ENV: 'production' }).REFRESH_COOKIE_SECURE).toBe(true);
  });

  it('rechaza valores fuera del enum o booleanos invalidos', () => {
    expect(() => validateEnv({ ...base, REFRESH_COOKIE_SAMESITE: 'cualquiera' })).toThrow();
    expect(() => validateEnv({ ...base, REFRESH_COOKIE_SECURE: 'si' })).toThrow();
  });
});
