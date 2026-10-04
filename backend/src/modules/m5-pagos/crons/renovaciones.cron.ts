import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { calcularVigencia } from '../../m1-usuarios/entities/membresia.entity';
import { MembresiasService } from '../../m1-usuarios/services/membresias.service';
import { MembresiaPrecioService } from '../../m1-usuarios/services/membresia-precio.service';
import { RenovacionesService } from '../services/renovaciones.service';

// RF-02 — renovación automática (simulada) de membresías.
//
// Corre cada día a medianoche, igual que el cron de VENCIDA de M1 (membresias.cron):
// los dos son jobs programados que simulan el proceso nocturno del caso. Vive en M5 y
// no en M1 a propósito — el cobro es de M5, y M5 ya importa M1 (el grafo es M5 → M1;
// ver pagos.module.ts). El comentario de `pagos.module.ts` ya lo adelantaba:
// `crons/renovaciones.cron.ts` era el lugar designado para esta RF.
//
// El orden es COBRAR primero y renovar después: un cobro rechazado deja la membresía
// como estaba (vencida, en mora) y el socio queda fuera de descuentos por RN-03. Solo
// un APROBADO extiende la fecha. La suspensión NO se renueva: es decisión del admin.

@Injectable()
export class RenovacionesCron {
  private readonly logger = new Logger(RenovacionesCron.name);

  constructor(
    private readonly membresias: MembresiasService,
    private readonly precios: MembresiaPrecioService,
    private readonly renovaciones: RenovacionesService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async renovar(): Promise<void> {
    const renovables = await this.membresias.listarRenovables(new Date());

    let renovadas = 0;
    let rechazadas = 0;

    for (const membresia of renovables) {
      try {
        await this.renovaciones.cobrarMembresia(
          { membresia_id: membresia.id, usuario_id: membresia.usuarioId, precio: membresia.precio },
          `renov-${membresia.id}-${membresia.fechaFin.getTime()}`,
        );
        // Solo un cobro aprobado llega acá. El periodo nuevo se calcula SOBRE la
        // fecha_fin previa (contiguo, mismo ancla que actualizar() en M1).
        const periodo = calcularVigencia(membresia.plan, membresia.fechaFin);
        await this.membresias.renovar(membresia.id, periodo);
        renovadas += 1;
      } catch {
        // Cobro rechazado o pendiente: no se renueva, la membresía queda vencida.
        rechazadas += 1;
      }
    }

    if (renovadas > 0 || rechazadas > 0) {
      this.logger.log(
        `Renovación automática: ${renovadas} renovadas, ${rechazadas} rechazadas.`,
      );
    }
  }
}