import { Injectable } from '@nestjs/common';
import {
  idempotenciaRepetida,
  pagoRechazado,
  recursoNoEncontrado,
  reservaYaCobrada,
} from '../../../commons/filters/problem.exception';
import { MembresiaPrecioService } from '../../m1-usuarios/services/membresia-precio.service';
import { ReservaPrecioService } from '../../m4-canchas/services/reserva-precio.service';
import { conceptoDePago, PagoIn } from '../dtos/pago-in.dto';
import { PagoOut } from '../dtos/pago-out.dto';
import { ConceptoPago, Pago } from '../entities/pago.entity';
import { PagoRepository } from '../repositories/pago.repository';
import { PasarelaPagoService, ResultadoPasarela } from './pasarela-pago.service';

// Los tres estados que puede devolver la pasarela. Es `ResultadoPasarela['estado']`
// y no `EstadoPago` a propósito: el dominio tiene cuatro (incluye ANULADO, que sale
// por `PagoRepository.anular()`) y el cobro solo puede llegar a tres. Ensanchar el
// tipo acá dejaría abierta la puerta a pasarle ANULADO al repositorio.
type EstadoCobro = ResultadoPasarela['estado'];

// El precio resuelto del concepto. Es un tipo PRIVADO de M5 a propósito: es la
// frontera entre "M5 no decide el importe" y "M5 tiene el importe para cobrar".
// Lo que entra por acá viene de M1 o de M4, nunca del cliente.
interface ConceptoResuelto {
  concepto: ConceptoPago;
  usuario_id: number;
  monto: number;
}

@Injectable()
export class PagosService {
  constructor(
    private readonly pagos: PagoRepository,
    private readonly pasarela: PasarelaPagoService,
    private readonly membresias: MembresiaPrecioService,
    private readonly reservas: ReservaPrecioService,
  ) {}

  /**
   * RF-13: el caso de uso del cobro, por HTTP.
   *
   * El orden de los pasos NO es negociable, y cada paso está en su lugar por una
   * razón concreta:
   *
   *   1. Resolver el concepto (404 si no existe). Primero, porque cobrar un id
   *      inexistente dejaría una fila de pago apuntando a la nada.
   *   2. Calcular el monto desde la regla de negocio de M1/M4. M5 NO decide el
   *      importe: lo copia (decisión 4 del plan).
   *   3. Insertar el pago PENDIENTE. ANTES de cobrar, y esto es lo que cierra la
   *      ventana de idempotencia: si el `@unique` salta, la pasarela no llega a
   *      invocarse y no se cobró dos veces. Insertar después de cobrar dejaría el
   *      hueco en el que un reintento concurrente pasa el `find`, cobra y recién
   *      ahí revienta el `@unique`, con el dinero ya movido (decisión 6).
   *   4. Cobrar con la pasarela.
   *   5. Transicionar según el resultado.
   *
   * La cabecera `Idempotency-Key` se valida en el controller: es transporte. Acá
   * llega ya presente porque es `required`.
   */
  async procesarPago(dto: PagoIn, idempotenciaKey: string): Promise<PagoOut> {
    const concepto = conceptoDePago(dto.concepto);
    const resuelto = await this.resolverConcepto(concepto);

    const creado = await this.pagos.crear({
      usuario_id: resuelto.usuario_id,
      concepto: resuelto.concepto,
      monto: resuelto.monto,
      moneda: dto.moneda ?? 'ARS',
      token: dto.token,
      idempotencia_key: idempotenciaKey,
    });

    if (!creado.ok) {
      // Se traduce acá y no en el repositorio: el repositorio no sabe qué status
      // HTTP ni qué `type` corresponde a cada motivo de dominio.
      //
      // La narrowing del `tipo` es lo que evita el `!` sobre `reserva_cancha_id`: si
      // el motivo es RESERVA_YA_COBRADA fue porque el concepto era una reserva, y el
      // resto de los casos caen en el default que el contrato ya declara.
      if (creado.motivo === 'RESERVA_YA_COBRADA' && resuelto.concepto.tipo === 'RESERVA_CANCHA') {
        throw reservaYaCobrada(resuelto.concepto.reserva_cancha_id);
      }
      throw idempotenciaRepetida();
    }

    // Recién ahora se toca la frontera externa. Si se cae, el pago queda PENDIENTE
    // en la base, que es el estado honesto de "no sabemos si se cobró".
    const resultado = await this.pasarela.cobrar({
      token: creado.pago.token,
      monto: creado.pago.monto,
      moneda: creado.pago.moneda,
      idempotencia_key: creado.pago.idempotencia_key,
    });

    const pago = await this.transicionar(creado.pago, resultado.estado);

    // El rechazo responde 402 con el motivo de la pasarela, pero el pago YA quedó
    // persistido como RECHAZADO: es un resultado de negocio y queda en el histórico
    // para poder consultarlo y reintentar con una clave nueva.
    if (resultado.estado === 'RECHAZADO') {
      throw pagoRechazado(resultado.motivo);
    }

    return this.aOut(pago);
  }

  /**
   * Deja el pago en `PENDIENTE` si la pasarela no pudo resolver. No se transiciona:
   * un cobro asíncrono real se resolvería después (por webhook, que el contrato no
   * modela) y hasta entonces el pago está PENDIENTE, que es lo que significa.
   */
  private async transicionar(pago: Pago, estado: EstadoCobro): Promise<Pago> {
    if (estado === 'PENDIENTE') {
      return pago;
    }
    return this.pagos.transicionar(pago.id, estado);
  }

  /**
   * Paso 1: el concepto existe y el monto sale de quien es dueño de ese dato.
   *
   * El monto NO se recalcula acá y NO viene del body: la reserva devuelve su
   * `precio_aplicado` congelado al reservar, y la membresía el precio de su plan.
   * Si M5 los volviera a computar, el comprobante dejaría de cuadrar con lo que se
   * reservó (decisión 4).
   *
   * Ojo con el 404: es "no existe", no "no se puede cobrar". Una reserva cancelada
   * o una membresía suspendida SÍ existen, y el contrato no declara ningún status
   * para "el concepto no está en estado de cobrarse": devolver un 422 con una regla
   * inventada sería documentar un comportamiento que el contrato no firma. Por eso
   * `estado` viene en el resultado y no se usa acá, y queda como deuda declarada
   * para cuando el contrato agregue esa respuesta.
   */
  private async resolverConcepto(concepto: ConceptoPago): Promise<ConceptoResuelto> {
    if (concepto.tipo === 'RESERVA_CANCHA') {
      const reserva = await this.reservas.obtenerParaCobro(concepto.reserva_cancha_id);
      if (!reserva) {
        throw recursoNoEncontrado(`No existe la reserva ${concepto.reserva_cancha_id}.`);
      }

      return {
        concepto,
        usuario_id: reserva.usuario_id,
        monto: reserva.precio,
      };
    }

    const membresia = await this.membresias.obtenerParaCobro(concepto.membresia_id);
    if (!membresia) {
      throw recursoNoEncontrado(`No existe la membresía ${concepto.membresia_id}.`);
    }

    return {
      concepto,
      usuario_id: membresia.usuario_id,
      monto: membresia.precio,
    };
  }

  private aOut(pago: Pago): PagoOut {
    return {
      id: pago.id,
      usuario_id: pago.usuario_id,
      concepto: pago.concepto,
      monto: pago.monto,
      moneda: pago.moneda,
      estado: pago.estado,
      fecha_pago: pago.fecha_pago,
      comprobante_pdf_url: pago.comprobante_pdf_url,
    };
  }
}