import { Injectable, Logger } from '@nestjs/common';
import type { CupoLiberadoEvent } from './cupo-liberado.event';
import type { CupoLiberadoObserver } from './cupo-liberado.observer';
import { EsperaClaseRepository } from '../repositories/espera-clase.repository';

@Injectable()
export class NotificarSociosEsperaObserver implements CupoLiberadoObserver {
  private readonly logger = new Logger(NotificarSociosEsperaObserver.name);

  constructor(private readonly esperasRepo: EsperaClaseRepository) {}

  async notificarCupoDisponible(evento: CupoLiberadoEvent): Promise<void> {
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
  }
}
