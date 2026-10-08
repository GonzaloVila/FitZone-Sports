import { Injectable } from '@nestjs/common';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { ReservaClasePrecioService } from '../../m3-clases/services/reserva-clase-precio.service';
import { PagoOut } from '../dtos/pago-out.dto';
import { ConceptoPago, Pago } from '../entities/pago.entity';
import {
  cobroRechazado,
  cobroRechazadoPendiente,
  idempotenciaRepetidaEnCobroInterno,
} from '../errors/renovaciones.errors';
import { PagoRepository } from '../repositories/pago.repository';
import { ComprobantesService } from './comprobantes.service';
import { PasarelaPagoService } from './pasarela-pago.service';

// RF-07: cobro interno de la penalidad por cancelacion tardia de una clase.
//
// M3 emite el evento `reservaClase.canceladaTardia` cuando el socio cancela una
// clase a menos de 2 hs del inicio, y M5 cobra. Mismo criterio que
// `RenovacionesService` (RF-02): se cobra PRIMERO con la pasarela y solo se
// inserta el Pago si aprobó, porque la cancelacion es consecuencia del pago — un
// RECHAZADO tiene que dejar todo como estaba (la reserva sigue CONFIRMADA).
//
// La pasarela es idempotente por `idempotencia_key`: la clave es determinista
// (`penalidad-clase-{id}`), así que reintentar el mismo evento devuelve el pago
// original sin cobrar dos veces.

export interface DatosPenalidadReservaClase {
  reservaClaseId: number;
}

@Injectable()
export class PenalidadReservaClaseService {
  constructor(
    private readonly pagos: PagoRepository,
    private readonly pasarela: PasarelaPagoService,
    private readonly comprobantes: ComprobantesService,
    // El importe (50% del valor nominal) y el usuario del socio los resuelve M3,
    // dueño de la reserva y la clase.
    private readonly reservaClases: ReservaClasePrecioService,
  ) {}

  async cobrarPenalidad(datos: DatosPenalidadReservaClase, idempotenciaKey: string): Promise<PagoOut> {
    const clase = await this.reservaClases.obtenerParaCobro(datos.reservaClaseId);
    if (!clase) {
      throw recursoNoEncontrado(`No existe la reserva de clase ${datos.reservaClaseId}.`);
    }

    const resultado = await this.pasarela.cobrar({
      token: 'tok_aprobado_penalidad',
      monto: clase.penalidad,
      moneda: 'ARS',
      idempotenciaKey: idempotenciaKey,
    });

    if (resultado.estado === 'RECHAZADO') {
      throw cobroRechazado(resultado.motivo);
    }
    if (resultado.estado !== 'APROBADO') {
      throw cobroRechazadoPendiente();
    }

    const creado = await this.pagos.crear({
      usuarioId: clase.usuarioId,
      concepto: this.conceptoClase(clase.reservaClaseId),
      monto: clase.penalidad,
      moneda: 'ARS',
      token: resultado.pasarelaToken,
      idempotenciaKey: idempotenciaKey,
    });

    if (!creado.ok) {
      // El @unique de idempotenciaKey saltó: este cobro ya se hizo con esta clave.
      // Se devuelve el pago existente (reintento del mismo evento), no un error.
      const existente = await this.pagos.buscarPorIdempotenciaKey(idempotenciaKey);
      if (existente) {
        return this.aOut(existente);
      }
      throw idempotenciaRepetidaEnCobroInterno();
    }

    const pagoAprobado = await this.pagos.transicionar(creado.pago.id, 'APROBADO');
    const pago = await this.emitirComprobante(pagoAprobado, clase.reservaClaseId);
    return this.aOut(pago);
  }

  private async emitirComprobante(pago: Pago, reservaClaseId: number): Promise<Pago> {
    if (pago.estado !== 'APROBADO') {
      return pago;
    }
    const ruta = await this.comprobantes.generar(pago, this.conceptoClase(reservaClaseId));
    return this.pagos.registrarComprobante(pago.id, ruta);
  }

  private conceptoClase(reservaClaseId: number): ConceptoPago {
    return { tipo: 'RESERVA_CLASE', reservaClaseId: reservaClaseId };
  }

  private aOut(pago: Pago): PagoOut {
    return {
      id: pago.id,
      usuarioId: pago.usuarioId,
      concepto: pago.concepto,
      monto: pago.monto,
      moneda: pago.moneda,
      estado: pago.estado,
      fechaPago: pago.fechaPago,
      comprobantePdfUrl: pago.comprobantePdfUrl,
    };
  }
}