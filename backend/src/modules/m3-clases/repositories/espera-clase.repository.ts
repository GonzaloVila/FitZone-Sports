import type { InjectionToken } from '@nestjs/common';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import type {
  EstadoEspera,
  EsperaClase,
  EsperaClaseNueva,
} from '../entities/espera-clase.entity';
import type { ReservaClase } from '../entities/reserva-clase.entity';

export const ESPERA_CLASE_REPOSITORY: InjectionToken = 'ESPERA_CLASE_REPOSITORY';

export interface FiltrosEsperasClase {
  clase_id?: number;
  socio_id?: number;
  estado?: EstadoEspera;
}

export type MotivoFalloEspera = 'ESPERA_EXISTENTE' | 'CUPO_DISPONIBLE' | 'CLASE_INEXISTENTE';

export type ResultadoCrearEspera =
  | { ok: true; espera: EsperaClase }
  | { ok: false; motivo: MotivoFalloEspera };

export type MotivoFalloConfirmacionEspera =
  | 'NO_NOTIFICADA'
  | 'CUPO_TOMADO'
  | 'ESPERA_INEXISTENTE'
  | 'RESERVA_DUPLICADA';

export type ResultadoConfirmarEspera =
  | { ok: true; reserva: ReservaClase }
  | { ok: false; motivo: MotivoFalloConfirmacionEspera };

export interface EsperaClaseRepository {
  listar(
    filtros: FiltrosEsperasClase,
    opciones: OpcionesPaginacion,
  ): Promise<EsperaClase[]>;
  crear(espera: EsperaClaseNueva): Promise<ResultadoCrearEspera>;
  buscarPorId(id: number): Promise<EsperaClase | null>;
  buscarActivaPorClaseYSocio(claseId: number, socioId: number): Promise<EsperaClase | null>;
  marcarCancelada(id: number): Promise<EsperaClase | null>;
    buscarEnEsperaPorClase(claseId: number): Promise<EsperaClase[]>;
    // Socio_ids de la cola viva: todo lo que no esta CANCELADO (EN_ESPERA y
    // NOTIFICADO). A diferencia de buscarEnEsperaPorClase NO depende del momento:
    // el observer de email la consulta en paralelo con marcarNotificados, asi que
    // tiene que devolver los mismos socios exista o no el cambio de estado.
    listarSociosEnEsperaPorClase(claseId: number): Promise<number[]>;
    marcarNotificados(claseId: number, fecha: Date): Promise<number>;
  confirmarEsperaConLock(esperaId: number): Promise<ResultadoConfirmarEspera>;
}
