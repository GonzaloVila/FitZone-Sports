import { Injectable } from '@nestjs/common';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { ReservaClasePrecioService } from '../../m3-clases/services/reserva-clase-precio.service';
import { PagoOut } from '../dtos/pago-out.dto';
import { ConceptoPago } from '../entities/pago.entity';
import { CobroInternoService } from './cobro-interno.service';

export interface DatosPenalidadReservaClase {
  reservaClaseId: number;
}

// RF-07: cobro interno de la penalidad por cancelación tardía de una clase. M3 emite
// `reservaClase.canceladaTardia` cuando el socio cancela con menos de 2 hs de
// anticipación, y M5 cobra. El flujo —cobrar primero, insertar el Pago solo si aprobó,
// emitir el comprobante— vive en `CobroInternoService`; acá se resuelve el concepto y el
// importe de la reserva de clase (que es dato de M3).
@Injectable()
export class PenalidadReservaClaseService {
  constructor(
    private readonly cobroInterno: CobroInternoService,
    // El importe (50% del valor nominal) y el usuario del socio los resuelve M3,
    // dueño de la reserva y la clase.
    private readonly reservaClases: ReservaClasePrecioService,
  ) {}

  async cobrarPenalidad(
    datos: DatosPenalidadReservaClase,
    idempotenciaKey: string,
  ): Promise<PagoOut> {
    const clase = await this.reservaClases.obtenerParaCobro(datos.reservaClaseId);
    if (!clase) {
      throw recursoNoEncontrado(`No existe la reserva de clase ${datos.reservaClaseId}.`);
    }

    return this.cobroInterno.cobrar(
      this.conceptoClase(clase.reservaClaseId),
      { usuarioId: clase.usuarioId, monto: clase.penalidad, token: 'tok_aprobado_penalidad' },
      idempotenciaKey,
    );
  }

  private conceptoClase(reservaClaseId: number): ConceptoPago {
    return { tipo: 'RESERVA_CLASE', reservaClaseId: reservaClaseId };
  }
}
