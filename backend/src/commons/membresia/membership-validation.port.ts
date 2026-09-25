import type { InjectionToken } from '@nestjs/common';

export const MEMBERSHIP_VALIDATION_PORT: InjectionToken = 'MEMBERSHIP_VALIDATION_PORT';

export interface VigenciaMembresia {
  vigente: boolean;
}

// Puerto en commons (mismo patrón que ProcesarPagoPort/MediadorService, ADR-01):
// M2 consulta vigencia de membresía sin importar SOCIO_REPOSITORY ni
// MEMBRESIA_REPOSITORY de M1 directamente (aislamiento entre módulos, ADR-07).
export interface MembershipValidationPort {
  consultarVigencia(usuarioId: number): Promise<VigenciaMembresia>;
}
