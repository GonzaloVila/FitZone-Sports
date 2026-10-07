import { Prisma } from '@prisma/client';

// Causa de base de datos, ya desligada del texto crudo del driver. Es la primera de
// las dos capas: este mapper sube el string de la base a una causa, una sola vez; el
// errors/ de cada modulo baja esa causa al vocabulario del contrato (por ejemplo
// EXCLUSION -> 409 turno-ocupado en m4-canchas/errors/reserva.errors).
export type CausaPrisma = 'UNIQUE' | 'EXCLUSION' | 'NO_ENCONTRADO' | 'FK';

const CODIGOS_CONOCIDOS: Record<string, CausaPrisma> = {
  P2002: 'UNIQUE',
  P2025: 'NO_ENCONTRADO',
  P2003: 'FK',
};

// Constraints de exclusion (EXCLUDE USING gist) que Prisma no modela. Una violacion
// (23P01) no llega como PrismaClientKnownRequestError sino como
// PrismaClientUnknownRequestError con `code` en undefined, y el nombre de la
// constraint solo aparece en el mensaje. Es el unico lugar del codigo donde viven
// estos nombres; sumar una constraint nueva es sumar una entrada aca.
const EXCLUSION_CONSTRAINTS: readonly string[] = ['exq_reserva_turno'];

export function mapearErrorPrisma(error: unknown): CausaPrisma | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return CODIGOS_CONOCIDOS[error.code] ?? null;
  }

  if (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    EXCLUSION_CONSTRAINTS.some((nombre) => error.message.includes(nombre))
  ) {
    return 'EXCLUSION';
  }

  return null;
}
