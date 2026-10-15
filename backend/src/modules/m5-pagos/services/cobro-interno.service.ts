import { Injectable } from '@nestjs/common';
import { aPagoOut, PagoOut } from '../dtos/pago-out.dto';
import { ConceptoPago, Pago } from '../entities/pago.entity';
import {
  cobroRechazado,
  cobroRechazadoPendiente,
  idempotenciaRepetidaEnCobroInterno,
} from '../errors/renovaciones.errors';
import { PagoRepository } from '../repositories/pago.repository';
import { ComprobantesService } from './comprobantes.service';
import { PasarelaPagoService } from './pasarela-pago.service';

// Datos que varían entre un cobro interno y otro: quién paga, cuánto y con qué token
// de pasarela. El concepto va aparte porque es lo que identifica al cobro.
export interface CobroInterno {
  usuarioId: number;
  monto: number;
  token: string;
}

/**
 * Flujo COMÚN de los cobros internos de M5 (RF-02 membresía y RF-07 penalidad de clase):
 * cobra PRIMERO con la pasarela y solo inserta el Pago si aprobó.
 *
 * Es el criterio que pide el flujo interno: el alta de un socio, el cambio de plan y la
 * penalidad de clase son "consecuencia del pago", así que un RECHAZADO tiene que dejar
 * TODO como estaba — sin fila de pago, sin socio, sin plan nuevo, sin cancelación. Si se
 * insertara el PENDIENTE primero, el rechazo dejaría una fila RECHAZADO apuntando a un
 * concepto que el emisor va a revertir, y quedaría un huérfano.
 *
 * A diferencia de `PagosService.procesarPago` (la vía HTTP), que inserta el Pago
 * PENDIENTE ANTES de tocar la pasarela para cerrar la ventana de idempotencia por HTTP,
 * este flujo cobra primero. Son dos semánticas distintas y por eso NO comparten método:
 * lo que se comparte acá es el flujo interno, que sí es idéntico entre sus dos callers.
 *
 * La pasarela es idempotente por `idempotencia_key`: repetir un cobro con la misma clave
 * devuelve el pago original sin mover dinero dos veces. La clave la arma quien emite
 * (alta / plan / penalidad), no el cliente.
 */
@Injectable()
export class CobroInternoService {
  constructor(
    private readonly pagos: PagoRepository,
    private readonly pasarela: PasarelaPagoService,
    private readonly comprobantes: ComprobantesService,
  ) {}

  async cobrar(concepto: ConceptoPago, cobro: CobroInterno, idempotenciaKey: string): Promise<PagoOut> {
    const resultado = await this.pasarela.cobrar({
      token: cobro.token,
      monto: cobro.monto,
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
      usuarioId: cobro.usuarioId,
      concepto: concepto,
      monto: cobro.monto,
      moneda: 'ARS',
      token: resultado.pasarelaToken,
      idempotenciaKey: idempotenciaKey,
    });

    if (!creado.ok) {
      // El @unique de idempotenciaKey saltó: este cobro ya se hizo con esta clave.
      // Se devuelve el pago existente (reintento del mismo evento), no un error.
      const existente = await this.pagos.buscarPorIdempotenciaKey(idempotenciaKey);
      if (existente) {
        return aPagoOut(existente);
      }
      throw idempotenciaRepetidaEnCobroInterno();
    }

    // El insert arranca en PENDIENTE (decisión 7 del plan de M5). El flujo interno es
    // síncrono y la pasarela ya respondió APROBADO arriba, así que se transiciona antes
    // de emitir el comprobante: el PDF (RF-14) solo se arma para pagos APROBADO.
    const pagoAprobado = await this.pagos.transicionar(creado.pago.id, 'APROBADO');
    const pago = await this.emitirComprobante(pagoAprobado, concepto);
    return aPagoOut(pago);
  }

  private async emitirComprobante(pago: Pago, concepto: ConceptoPago): Promise<Pago> {
    if (pago.estado !== 'APROBADO') {
      return pago;
    }
    const ruta = await this.comprobantes.generar(pago, concepto);
    return this.pagos.registrarComprobante(pago.id, ruta);
  }
}
