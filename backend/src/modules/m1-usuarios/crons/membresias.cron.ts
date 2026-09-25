import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MEMBRESIA_REPOSITORY, MembresiaRepository } from '../repositories/membresia.repository';

// Job diario que cierra el gap descrito en membresia.entity.ts (estaVigente):
// sin este cron, `estado` nunca se movería de ACTIVA a VENCIDA por sí solo.
@Injectable()
export class MembresiasCron {
  private readonly logger = new Logger(MembresiasCron.name);

  constructor(
    @Inject(MEMBRESIA_REPOSITORY) private readonly membresias: MembresiaRepository,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async marcarVencidas(): Promise<void> {
    const cantidad = await this.membresias.marcarVencidas();
    if (cantidad > 0) {
      this.logger.log(`Membresías marcadas como VENCIDA: ${cantidad}`);
    }
  }
}
