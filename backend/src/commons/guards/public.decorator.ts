import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marca un handler o un controller como abierto: JwtAuthGuard (global) no exige
// token. Todo endpoint exige sesion por defecto; usar @Public() es una excepcion
// y obliga a actualizar el test que fija el conjunto de rutas publicas
// (test/e2e/auth/rutas-publicas.e2e-spec.ts).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
