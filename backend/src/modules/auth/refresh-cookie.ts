import type { CookieOptions } from 'express';

export const REFRESH_COOKIE = 'refresh_token';

// La cookie solo viaja a las rutas de auth: el prefijo global api/v1 hace que
// Path=/auth no coincida con ninguna ruta real.
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export interface AjustesCookie {
  maxAgeSegundos: number;
  sameSite: 'strict' | 'lax' | 'none';
  secure: boolean;
}

export function opcionesCookieRefresh(ajustes: AjustesCookie): CookieOptions {
  return {
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
    // Express espera milisegundos y los emite como Max-Age en segundos.
    maxAge: ajustes.maxAgeSegundos * 1000,
    sameSite: ajustes.sameSite,
    secure: ajustes.secure,
  };
}

// Mismas opciones de Path/SameSite/Secure y Max-Age 0, para que el navegador la
// descarte (una cookie solo se borra si coincide el Path con el que se seteo).
export function opcionesBorrarCookieRefresh(ajustes: AjustesCookie): CookieOptions {
  return { ...opcionesCookieRefresh(ajustes), maxAge: 0 };
}

// Defensa CSRF cuando el refresh token llega por cookie: el navegador siempre
// manda Origin en un POST cross-origin y JS no puede falsearlo. Comparacion
// exacta; "null" (origen opaco) tampoco esta en la lista, asi que se rechaza.
export function origenPermitido(origin: string | undefined, permitidos: readonly string[]): boolean {
  return origin !== undefined && permitidos.includes(origin);
}

// El canal movil se declara con X-Cliente: movil (no se infiere del User-Agent).
export function esClienteMovil(cabecera: string | undefined): boolean {
  return cabecera?.trim().toLowerCase() === 'movil';
}
