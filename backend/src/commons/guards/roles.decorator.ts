import { SetMetadata } from '@nestjs/common';
import type { RolUsuario } from '../../modules/m1-usuarios/entities/usuario.entity';

export const ROLES_KEY = 'roles';

// Decorador de autorizacion: @Roles('GERENTE', 'RECEPCION') sobre un handler o
// un controller. RolesGuard lee esta metadata con el Reflector; sin el
// decorador, RolesGuard deja pasar (no hay rol exigido).
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
