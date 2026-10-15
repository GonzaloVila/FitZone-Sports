import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTO_CUPO_LIBERADO } from '../../../commons/eventos';
import { EsperaClaseRepository } from '../repositories/espera-clase.repository';
import type { CupoLiberadoEvent } from './cupo-liberado.event';

// Observer del cupo liberado (RF-08), canal ESTADO: lleva la lista de espera a
// NOTIFICADO. Es un oyente del bus (EventEmitter2), igual que la catedra usa
// @EventListener en Spring: el emisor (cancelarReservaClase) no lo conoce.
@Injectable()
export class NotificarSociosEsperaObserver {
  private readonly logger = new Logger(NotificarSociosEsperaObserver.name);

  constructor(private readonly esperasRepo: EsperaClaseRepository) {}

  // Aisla y loguea: un fallo aca NO debe romper la cancelacion que disparo el evento.
  @OnEvent(EVENTO_CUPO_LIBERADO)
  async notificarCupoDisponible(evento: CupoLiberadoEvent): Promise<void> {
    try {
      const anotados = await this.esperasRepo.buscarEnEsperaPorClase(evento.claseId);
      if (anotados.length === 0) {
        this.logger.log(`No hay socios en espera para la clase ${evento.claseId}`);
        return;
      }

      const fechaNotificacion = new Date();
      const cantidadActualizada = await this.esperasRepo.marcarNotificados(
        evento.claseId,
        fechaNotificacion,
      );

      this.logger.log(
        `Notificados ${cantidadActualizada} socios en espera para la clase ${evento.claseId}. Modalidad first-come activada.`,
      );
    } catch (err) {
      this.logger.error(
        `Error notificando la espera de la clase ${evento.claseId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
