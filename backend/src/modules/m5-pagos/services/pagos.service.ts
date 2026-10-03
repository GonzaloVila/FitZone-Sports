import { Injectable } from '@nestjs/common';
import {
  idempotenciaRepetida,
  pagoNoAprobado,
  pagoNoAnulable,
  pagoRechazado,
  recursoNoEncontrado,
  reservaYaCobrada,
} from '../../../commons/filters/problem.exception';
import { rangoDelDia } from '../../../commons/fechas';
import { MembresiaPrecioService } from '../../m1-usuarios/services/membresia-precio.service';
import { ReservaPrecioService } from '../../m4-canchas/services/reserva-precio.service';
import { conceptoDePago, PagoIn } from '../dtos/pago-in.dto';
import { PagoOut } from '../dtos/pago-out.dto';
import { ConceptoPago, Pago } from '../entities/pago.entity';
import { FiltrosListarPagos, PagoRepository } from '../repositories/pago.repository';
import { ComprobantesService } from './comprobantes.service';
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

/**
 * Lo que `obtenerComprobante()` le da al controller: los bytes y el nombre con el que
 * bajan. Es un tipo propio y no un `Pago` porque el controller no necesita el pago, y
 * devolver la entidad entera tentaría a serializarla en la respuesta.
 */
export interface ComprobanteParaDescargar {
  buffer: Buffer;
  nombre: string;
}

/**
 * Los filtros que llegan del controller, todavía en días, más la paginación.
 *
 * Extiende `FiltrosListarPagos` EXCEPTO el rango: el repositorio lo quiere en instantes
 * y el service lo traduce, así que acá `desde`/`hasta` son strings y se redeclaran. Es la
 * misma separación que en M4, donde el service recibe `fecha?: string` y le pasa al
 * repositorio el `rangoDelDia()` de esa fecha.
 */
export interface ListarPagos extends Omit<FiltrosListarPagos, 'desde' | 'hasta'> {
  desde?: string;
  hasta?: string;
  page: number;
  perPage: number;
}

@Injectable()
export class PagosService {
  constructor(
    private readonly pagos: PagoRepository,
    private readonly pasarela: PasarelaPagoService,
    private readonly membresias: MembresiaPrecioService,
    private readonly reservas: ReservaPrecioService,
    private readonly comprobantes: ComprobantesService,
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

    return this.aOut(await this.emitirComprobante(pago, resuelto.concepto));
  }

  /**
   * RF-13: el listado de pagos, con la lista blanca de filtros del contrato.
   *
   * Lo único que este método hace que no sea un `map` es el default del `estado`: sin
   * `?estado=` devuelve SOLO los APROBADO, porque es el único estado en el que el dinero
   * se movió y hay comprobante. Los otros tres existen y no se borran (un anulado se
   * repaga con una clave nueva), pero se piden explícitos. El default va acá y no en el
   * DTO ni en el repositorio porque es negocio: el repositorio no decide defaults y el
   * DTO no describe reglas.
   *
   * `desde`/`hasta` son días INCLUSIVOS en hora local, que es lo que dice el contrato
   * (`?desde=2026-03-01&hasta=2026-03-31` trae todo marzo). `rangoDelDia()` devuelve
   * `[desde, hasta)` semiabierto, así que el `hasta` se pasa como `lt` del día siguiente
   * al que se pidió: el último día entra completo y el día siguiente no. Por eso el
   * filtro no puede ser un `gte`/`lte` con las fechas tal cual.
   */
  async listarPagos({ page, perPage, ...filtros }: ListarPagos): Promise<PagoOut[]> {
    const desde = filtros.desde !== undefined ? rangoDelDia(filtros.desde).desde : undefined;
    const hasta = filtros.hasta !== undefined ? rangoDelDia(filtros.hasta).hasta : undefined;

    const filas = await this.pagos.listar(
      {
        ...filtros,
        estado: filtros.estado ?? 'APROBADO',
        desde,
        hasta,
      },
      { page, perPage },
    );

    return filas.map((pago) => this.aOut(pago));
  }

  /**
   * `GET /pagos/{pago_id}`: el pago por id, o 404.
   *
   * Reusa `buscarPorId()` del repositorio tal cual: el `aOut()` de acá ya omite `token` e
   * `idempotencia_key`, así que no hay nada que filtrar antes de devolver. Que un GET
   * por id y el comprobante compartan la búsqueda es a propósito: el endpoint del PDF
   * necesita el mismo dato y con el mismo criterio de "no existe".
   */
  async obtenerPago(pagoId: number): Promise<PagoOut> {
    const pago = await this.pagos.buscarPorId(pagoId);
    if (!pago) {
      throw recursoNoEncontrado(`No existe el pago ${pagoId}.`);
    }

    return this.aOut(pago);
  }

  /**
   * Anula un pago. Es la ÚNICA forma de pasarlo a `ANULADO` (no hay `PATCH` ni `DELETE`
   * en `/pagos`) y el pago anulado no se borra: queda en el histórico y se repaga con una
   * `Idempotency-Key` nueva.
   *
   * Los tres caminos, en orden:
   *
   *  1. No existe → 404.
   *  2. Ya está `ANULADO` → 204 sin escribir nada. Reanular es idempotente: el estado
   *     pedido ya es el actual, y el contrato lo declara así. Es el criterio de
   *     `salirDeEspera` en M3 y el opuesto DELIBERADO de `cancelarReservaCancha` en M4,
   *     que sí es 409 porque el contrato lo define así. No se vuelve a llamar a la
   *     pasarela en este caso: reembolsar un pago ya devuelto devolvería dos veces.
   *  3. `RECHAZADO` → 409 `PagoNoAnulable`. Nunca se cobró, así que no hay nada que
   *     devolver ni a la pasarela ni al socio.
   *
   * El filtro de qué estados son anulables lo hace el propio UPDATE del repositorio
   * (no un `if` acá): dos anulaciones simultáneas del mismo pago no pueden ganar las
   * dos. Si el UPDATE no matcheó, el estado no era `PENDIENTE` ni `APROBADO`, y como
   * los casos 1 y 2 ya están resueltos arriba, el que queda es `RECHAZADO`.
   *
   * El `reembolsar` se invoca solo si el pago estaba `APROBADO`: un `PENDIENTE` nunca se
   * cobró, así que no hay contra qué devolver, y el caso es el que el plan llama "si
   * corresponde".
   */
  async anularPago(pagoId: number): Promise<void> {
    const pago = await this.pagos.buscarPorId(pagoId);
    if (!pago) {
      throw recursoNoEncontrado(`No existe el pago ${pagoId}.`);
    }

    if (pago.estado === 'ANULADO') {
      return;
    }

    const anulado = await this.pagos.anular({
      id: pagoId,
      token: pago.token,
      monto: pago.monto,
      moneda: pago.moneda,
    });

    if (!anulado) {
      throw pagoNoAnulable(pagoId, 'RECHAZADO');
    }

    if (pago.estado !== 'APROBADO') {
      return;
    }

    // Si la devolución falla, el pago queda ANULADO igual y el error sube. Declararlo es
    // más honesto que tragarse el fallo y devolver 204: el estado local ya cambió y no
    // se puede volver atrás sin mentir sobre un hecho que ocurrió. El contrato no
    // declara una respuesta para "se anuló pero no se pudo devolver" y con el mock esto
    // no se puede producir: es deuda declarada para cuando haya pasarela real.
    const reembolso = await this.pasarela.reembolsar({
      token: pago.token,
      monto: pago.monto,
      moneda: pago.moneda,
      idempotencia_key: pago.idempotencia_key,
    });

    if (!reembolso.ok) {
      throw new Error(
        `El pago ${pagoId} quedó ANULADO pero la pasarela no devolvió el dinero: ${reembolso.motivo}`,
      );
    }
  }

  /**
   * RF-14: servir el comprobante de un pago.
   *
   * El orden de las tres validaciones es el que da el status correcto y no por casualidad:
   *
   *  1. El pago no existe → 404. No se puede responder "no aprobado" de un pago que no
   *     está, porque el 409 afirma un estado y no hay estado que afirmar.
   *  2. El pago no está `APROBADO` → 409 `PagoNoAprobado`. El contrato responde igual para
   *     `PENDIENTE`, `RECHAZADO` y `ANULADO`, y es lo correcto: en los tres casos no hay un
   *     comprobante que entregar. Un `ANULADO` sí tuvo comprobante y sigue en disco, pero
   *     el contrato lo niega igual, así que no se sirve — el comprobante de un cobro
   *     devuelto es un documento histórico, no algo que se descargue a pedido.
   *  3. El archivo no está (columna vacía o `storage/` limpiado) → 404. Es la misma
   *     respuesta que "no existe el pago" y a propósito: el contrato declara un solo 404
   *     para este endpoint y el cliente no necesita distinguir por qué falta algo que el
   *     contrato no promete.
   *
   * Devuelve el `Buffer` y el nombre del archivo, no el `PDFDocument`: el service no
   * arma el PDF acá, lo lee del snapshot.
   */
  async obtenerComprobante(pagoId: number): Promise<ComprobanteParaDescargar> {
    const pago = await this.pagos.buscarPorId(pagoId);
    if (!pago) {
      throw recursoNoEncontrado(`No existe el pago ${pagoId}.`);
    }

    if (pago.estado !== 'APROBADO') {
      throw pagoNoAprobado(pagoId, pago.estado);
    }

    if (!pago.comprobante_pdf_url) {
      throw recursoNoEncontrado(`El pago ${pagoId} no tiene comprobante.`);
    }

    const buffer = await this.comprobantes.leer(pago.comprobante_pdf_url);
    if (!buffer) {
      throw recursoNoEncontrado(`El comprobante del pago ${pagoId} no está disponible.`);
    }

    // El nombre que baja el navegador no es el del archivo en disco: el interno es
    // `{id}.pdf` y no le dice nada a quien lo descarga.
    return { buffer, nombre: `comprobante-pago-${pagoId}.pdf` };
  }

  /**
   * RF-14: arma el comprobante una sola vez, en el momento del cobro.
   *
   * Va después de `transicionar()` y no antes porque el comprobante lleva el id del pago
   * (que solo existe después del insert) y porque un pago que no quedó `APROBADO` no tiene
   * comprobante: un `RECHAZADO` nunca lo tuvo y un `PENDIENTE` todavía no sabe si lo va a
   * tener.
   *
   * `generar()` puede fallar si el disco no deja escribir, y el error sube. Es a
   * propósito: el pago ya está APROBADO y el dinero ya se movió, así que el problema real
   * es que el comprobante falta, y ocultarlo dejaría un cobro aprobado sin comprobante
   * sin que nadie se entere. Lo que NO se hace es volver atrás el estado para "dejar todo
   * como estaba": eso sí sería mentir sobre un cobro que ocurrió.
   */
  private async emitirComprobante(pago: Pago, concepto: ConceptoPago): Promise<Pago> {
    if (pago.estado !== 'APROBADO') {
      return pago;
    }

    const ruta = await this.comprobantes.generar(pago, concepto);
    return this.pagos.registrarComprobante(pago.id, ruta);
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