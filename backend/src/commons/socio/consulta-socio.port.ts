import type { InjectionToken } from '@nestjs/common';

export const CONSULTA_SOCIO_PORT: InjectionToken = 'CONSULTA_SOCIO_PORT';

// Puerto en commons (mismo patrón que SedeValidationPort, ADR-01/07): M3 necesita el
// email del socio para el aviso de cupo liberado, pero no debe importar
// SOCIO_REPOSITORY de M1 directamente (aislamiento entre módulos, ADR-07).
export interface ConsultaSocioPort {
  obtenerEmail(socioId: number): Promise<string | null>;
}
