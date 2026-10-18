import { z } from 'zod';

// Booleano de entorno: z.coerce.boolean() trataria "false" como true (cualquier
// string no vacio), asi que se aceptan solo estos literales.
const booleanoDeEntorno = z.enum(['true', 'false']).transform((valor) => valor === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url(),
    MP_TOKEN: z.string().optional().default(''),
    // Default solo para dev/test: en produccion se exige por variable de
    // entorno real (no hay validacion de longitud minima aca a proposito, para
    // no acoplar este esquema a una politica de secreto que vive en el deploy).
    JWT_SECRET: z.string().min(1).default('dev-secret-fitzone-cambiar-en-produccion'),
    // Segundos hasta el vencimiento del accessToken (contrato: expiresIn). Corto a
    // proposito: el front lo guarda en memoria y lo renueva con el refresh token.
    JWT_EXPIRES_IN: z.coerce.number().int().positive().default(900),
    // Segundos de vida del refresh token (y Max-Age de su cookie).
    REFRESH_EXPIRES_IN: z.coerce.number().int().positive().default(604800),
    // Origenes permitidos por CORS, separados por coma. Tambien es la lista
    // contra la que se valida el header Origin cuando el refresh token viaja
    // por cookie (defensa CSRF, ademas de SameSite).
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((valor) =>
        valor
          .split(',')
          .map((origen) => origen.trim())
          .filter((origen) => origen.length > 0),
      ),
    REFRESH_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('lax'),
    // Sin valor explicito: true solo en production (ver transform de abajo).
    REFRESH_COOKIE_SECURE: booleanoDeEntorno.optional(),
    // Clave AES-256 (32 bytes) en base64 para cifrar Socio.totpSecreto en
    // reposo. Default solo para dev/test, igual que JWT_SECRET: en produccion
    // se completa por variable de entorno real.
    TOTP_ENCRYPTION_KEY: z
      .string()
      .min(1)
      .default('HT3zZIzLOfDe+USpRsLaw6OubDaTiqAe0gdEMNt74mo='),
  })
  .transform((env, ctx) => {
    const secure = env.REFRESH_COOKIE_SECURE ?? env.NODE_ENV === 'production';
    // Los navegadores descartan una cookie SameSite=None sin Secure.
    if (env.REFRESH_COOKIE_SAMESITE === 'none' && !secure) {
      ctx.addIssue({
        code: 'custom',
        path: ['REFRESH_COOKIE_SECURE'],
        message: "REFRESH_COOKIE_SAMESITE='none' exige REFRESH_COOKIE_SECURE=true",
      });
      return z.NEVER;
    }
    return { ...env, REFRESH_COOKIE_SECURE: secure };
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Configuración de entorno inválida: ${issues}`);
  }
  return parsed.data;
}
