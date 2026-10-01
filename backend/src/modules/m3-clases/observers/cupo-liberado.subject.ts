import { Injectable, Logger } from '@nestjs/common';
import type { CupoLiberadoEvent } from './cupo-liberado.event';
import type { CupoLiberadoObserver } from './cupo-liberado.observer';

@Injectable()
export class CupoLiberadoSubject {
  private readonly logger = new Logger(CupoLiberadoSubject.name);
  private readonly observers: CupoLiberadoObserver[] = [];

  registrarObserver(observer: CupoLiberadoObserver): void {
    this.observers.push(observer);
    this.logger.log(`Observer registrado: ${observer.constructor.name}`);
  }

  async notificar(evento: CupoLiberadoEvent): Promise<void> {
    this.logger.log(
      `Despachando evento CupoLiberado para clase ${evento.claseId} a ${this.observers.length} observers`,
    );
    await Promise.all(
      this.observers.map((observer) =>
        observer.notificarCupoDisponible(evento).catch((err) => {
          this.logger.error(
            `Error en observer ${observer.constructor.name}: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err.stack : undefined,
          );
        }),
      ),
    );
  }
}
