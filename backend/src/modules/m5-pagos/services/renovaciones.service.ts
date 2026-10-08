import { Injectable } from '@nestjs/common';
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

// RF-02 (renovación automática + cobro interno del alta y del cambio de plan).
//
// A diferencia de `PagosService.procesarPago` (que inserta el Pago PENDIENTE ANTES
// de tocar la pasarela para cerrar la ventana de idempotencia por HTTP), este service
// cobra PRIMERO y solo inserta el Pago si la pasarela aprobó. Es el criterio que pide
// el flujo interno: el alta de un socio y el cambio de plan sobre una membresía no
// vigente son "consecuencia del pago", así que un RECHAZADO tiene que dejar TODO como
// estaba — sin fila de pago, sin socio, sin plan nuevo. Si se insertara el PENDIENTE
// primero, el rechazo dejaría una fila RECHAZADO apuntando a un concepto que el
// emisor (M1) va a revertir, y quedaría un huérfano.
//
// La pasarela es idempotente por `idempotencia_key` (misma regla que el flujo HTTP):
// repetir un cobro con la misma clave devuelve el pago original sin mover dinero dos
// veces. La clave la arma quien emite (alta/plan/renovación), no el cliente.

export interface DatosCobroMembresia {
  membresiaId: number;
  usuarioId: number;
  precio: number;
}

@Injectable()
export class RenovacionesService {
  constructor(
    private readonly pagos: PagoRepository,
    private readonly pasarela: PasarelaPagoService,
    private readonly comprobantes: ComprobantesService,
  ) {}

  /**
   * Cobra la membresía de un socio (alta, cambio de plan o renovación automática).
   *
   * - APROBADO  → inserta el Pago (+ subtipo + comprobante) y lo devuelve.
   * - RECHAZADO → lanza `cobroRechazado` (402) sin persistir nada: el emisor revierte.
   * - PENDIENTE → lanza el mismo 402: el flujo interno es síncrono y no modela cobros
   *   asíncronos, así que el único resultado que deja fila es APROBADO.
   *
   * Si la `idempotencia_key` ya existe (un cobro previo con la misma clave), el
   * `@unique` de Pago lo atrapa y se devuelve el pago original: la pasarela simulada
   * no cobró dos veces, que es lo que la clave garantiza.
   */
  async cobrarMembresia(datos: DatosCobroMembresia, idempotenciaKey: string): Promise<PagoOut> {
    const resultado = await this.pasarela.cobrar({
      token: 'tok_aprobado_membresia',
      monto: datos.precio,
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
      usuarioId: datos.usuarioId,
      concepto: this.conceptoMembresia(datos.membresiaId),
      monto: datos.precio,
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

    // El insert arranca en PENDIENTE (decisión 7 del plan de M5). El flujo interno
    // es síncrono y la pasarela ya respondió APROBADO arriba, así que se transiciona
    // antes de emitir el comprobante: el PDF (RF-14) solo se arma para pagos APROBADO.
    const pagoAprobado = await this.pagos.transicionar(creado.pago.id, 'APROBADO');
    const pago = await this.emitirComprobante(pagoAprobado, datos);
    return this.aOut(pago);
  }

  private async emitirComprobante(pago: Pago, datos: DatosCobroMembresia): Promise<Pago> {
    if (pago.estado !== 'APROBADO') {
      return pago;
    }
    const ruta = await this.comprobantes.generar(pago, this.conceptoMembresia(datos.membresiaId));
    return this.pagos.registrarComprobante(pago.id, ruta);
  }

  private conceptoMembresia(membresiaId: number): ConceptoPago {
    return { tipo: 'MEMBRESIA', membresiaId: membresiaId };
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