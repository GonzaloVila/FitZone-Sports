import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

// Todos los mensajes de validación de un body/query, incluyendo los anidados.
//
// Baja a `children` a propósito: `@ValidateNested()` deja los errores del objeto
// anidado ahí y el `constraints` del nivel superior queda vacío, así que leer solo
// `constraints` devuelve [] para cualquier body mal formado y un test que asegura
// [] pasaría siempre. Mismo criterio que pago-in.dto.spec.ts.
export async function erroresDe<T extends object>(
  clase: new () => T,
  dto: Record<string, unknown>,
): Promise<string[]> {
  const instancia = plainToInstance(clase, dto);
  const resultado = await validate(instancia, { whitelist: true, forbidNonWhitelisted: true });

  function aplanar(errores: ValidationError[]): string[] {
    return errores.flatMap((e) => [...Object.values(e.constraints ?? {}), ...aplanar(e.children ?? [])]);
  }

  return aplanar(resultado);
}
