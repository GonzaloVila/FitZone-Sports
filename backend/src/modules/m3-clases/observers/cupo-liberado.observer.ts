import type { CupoLiberadoEvent } from './cupo-liberado.event';

export interface CupoLiberadoObserver {
  notificarCupoDisponible(evento: CupoLiberadoEvent): Promise<void>;
}
