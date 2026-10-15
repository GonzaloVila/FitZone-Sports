import { Injectable } from '@nestjs/common';
import { PagoOut } from '../dtos/pago-out.dto';
import { ConceptoPago } from '../entities/pago.entity';
import { CobroInternoService } from './cobro-interno.service';

export interface DatosCobroMembresia {
  membresiaId: number;
  usuarioId: number;
  precio: number;
}

// RF-02: cobro interno de membresía (alta de socio, cambio de plan sobre membresía no
// vigente y renovación automática). El flujo —cobrar primero, insertar el Pago solo si
// aprobó, emitir el comprobante— vive en `CobroInternoService`; acá solo se resuelve el
// concepto de membresía. La entrada la disparan `RenovacionesListener` (eventos de M1) y
// `RenovacionesCron` (medianoche).
@Injectable()
export class RenovacionesService {
  constructor(private readonly cobroInterno: CobroInternoService) {}

  async cobrarMembresia(datos: DatosCobroMembresia, idempotenciaKey: string): Promise<PagoOut> {
    return this.cobroInterno.cobrar(
      this.conceptoMembresia(datos.membresiaId),
      { usuarioId: datos.usuarioId, monto: datos.precio, token: 'tok_aprobado_membresia' },
      idempotenciaKey,
    );
  }

  private conceptoMembresia(membresiaId: number): ConceptoPago {
    return { tipo: 'MEMBRESIA', membresiaId: membresiaId };
  }
}
