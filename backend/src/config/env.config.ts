import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  MP_TOKEN: z.string().optional().default(''),
  // Default solo para dev/test: en produccion se exige por variable de
  // entorno real (no hay validacion de longitud minima aca a proposito, para
  // no acoplar este esquema a una politica de secreto que vive en el deploy).
  JWT_SECRET: z.string().min(1).default('dev-secret-fitzone-cambiar-en-produccion'),
  // Segundos hasta el vencimiento del accessToken (contrato: expiresIn).
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(3600),
  // Clave AES-256 (32 bytes) en base64 para cifrar Socio.totpSecreto en
  // reposo. Default solo para dev/test, igual que JWT_SECRET: en produccion
  // se completa por variable de entorno real.
  TOTP_ENCRYPTION_KEY: z
    .string()
    .min(1)
    .default('HT3zZIzLOfDe+USpRsLaw6OubDaTiqAe0gdEMNt74mo='),
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