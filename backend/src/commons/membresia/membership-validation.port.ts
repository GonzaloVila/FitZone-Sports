import type { InjectionToken } from '@nestjs/common';

export const MEMBERSHIP_VALIDATION_PORT: InjectionToken = 'MEMBERSHIP_VALIDATION_PORT';

export interface VigenciaMembresia {
  vigente: boolean;
}

export interface EstadoSocioMembresia {
  esSocio: boolean;
  vigente: boolean;
  enMora: boolean;
}

// Puerto en commons (mismo patrón que ProcesarPagoPort/MediadorService, ADR-01):
// M2 y M3 consultan vigencia y mora sin importar SOCIO_REPOSITORY ni
// MEMBRESIA_REPOSITORY de M1 directamente (aislamiento entre módulos, ADR-07).
export interface MembershipValidationPort {
  consultarVigencia(usuarioId: number): Promise<VigenciaMembresia>;
  consultarVigenciaPorSocio(socioId: number): Promise<EstadoSocioMembresia>;
}

