import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTO_MEMBRESIA_PLAN, EVENTO_SOCIO_ALTA } from '../../../commons/eventos';
import { DatosCobroMembresia, RenovacionesService } from './renovaciones.service';

// Puerta de entrada del cobro interno de membresía (RF-02).
//
// M1 emite estos eventos tras crear un socio o cambiar el plan de una membresía no
// vigente, y M5 escucha para cobrar SIN que M1 importe a M5 (el grafo es M5 → M1, sin
// ciclos; ver pagos.module.ts). `EventEmitterModule.forRoot()` es global y síncrono, y
// M1 usa `emitAsync` para esperar el resultado del listener: si acá se lanza (cobro
// rechazado), el error se propaga al emisor y M1 revierte su operación.

export interface EventoDatosAlta extends DatosCobroMembresia {
  socio_id: number;
  plan: string;
}

export interface EventoDatosPlan extends DatosCobroMembresia {
  plan: string;
}

@Injectable()
export class RenovacionesListener {
  constructor(private readonly renovaciones: RenovacionesService) {}

  @OnEvent(EVENTO_SOCIO_ALTA)
  async onSocioAlta(datos: EventoDatosAlta): Promise<void> {
    await this.renovaciones.cobrarMembresia(datos, `alta-${datos.socio_id}`);
  }

  @OnEvent(EVENTO_MEMBRESIA_PLAN)
  async onMembresiaPlan(datos: EventoDatosPlan): Promise<void> {
    await this.renovaciones.cobrarMembresia(datos, `plan-${datos.membresia_id}-${Date.now()}`);
  }
}