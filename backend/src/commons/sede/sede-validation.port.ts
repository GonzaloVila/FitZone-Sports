import type { InjectionToken } from '@nestjs/common';

export const SEDE_VALIDATION_PORT: InjectionToken = 'SEDE_VALIDATION_PORT';

// Puerto en commons (mismo patrón que MembershipValidationPort/MediadorService,
// ADR-01): M4 consulta existencia de sede sin importar SEDE_REPOSITORY de M2
// directamente (aislamiento entre módulos, ADR-07).
export interface SedeValidationPort {
  existeSede(sedeId: number): Promise<boolean>;
}
