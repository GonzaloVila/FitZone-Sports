import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import { Pago, PagoAAnular, PagoNuevo } from '../entities/pago.entity';

/**
 * Decisión 6 del plan: la idempotencia la garantiza el `@unique` del esquema, no
 * una consulta previa. Consultar "si ya existe un pago con esta clave" antes de
 * insertar deja una carrera entre dos reintentos simultáneos de la misma clave:
 * los dos pasan el `find`, los dos cobran y después uno revienta el `@unique` con
 * el dinero ya movido. Insertando primero y traduciendo el `P2002` no hay ventana:
 * el cobro solo sigue adelante si el insertó.
 *
 * Los dos `@unique` que puede saltar el insert son distintos y significan cosas
 * distintas, así que NO se collapsan en un motivo único:
 *
 *  - `Pago.idempotencia_key` → el cliente reintenta el mismo cobro. Es el caso que
 *    el contrato llama `IdempotenciaRepetida`.
 *  - `PagoReserva.reserva_id` → una reserva que ya fue cobrada, con una clave
 *    nueva. No es idempotencia: es un intento de cobrar dos veces la misma reserva,
 *    y por eso el detalle tiene que decirlo. (Una membresía NO cae acá:
 *    `PagoMembresia.membresia_id` no es unique a propósito, porque una membresía
 *    admite un pago por renovación.)
 */
export type ResultadoCrearPago =
  | { ok: true; pago: Pago }
  | { ok: false; motivo: 'IDEMPOTENCIA_REPETIDA' | 'RESERVA_YA_COBRADA' };

// El pago con su subtipo, que es lo que hace falta para reconstruir el `ConceptoPago`
// (decisión 3: el polimorfismo es de esquema, no de `tipo` + `concepto_id` sueltos).
type PagoConSubtipo = Prisma.PagoGetPayload<{
  include: { pago_reserva: true; pago_membresia: true };
}>;

@Injectable()
export class PagoRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inserta el pago PENDIENTE y su subtipo en UNA sola sentencia.
   *
   * El alta del subtipo va anidada (`pago_reserva: { create: ... }`) y no en un
   * `$transaction` aparte a propósito: es lo mismo de atómico y encima no deja el
   * caso intermedio de un `Pago` sin subtipo, que es una fila que no corresponde a
   * ningún concepto y que el listado no sabría traducir a `ConceptoPago`.
   *
   * El orden importa para la idempotencia: esta es la ÚNICA escritura que bloquea
   * el cobro. Recién después de que salió `ok: true` se invoca a la pasarela.
   */
  async crear(pago: PagoNuevo): Promise<ResultadoCrearPago> {
    // Se usa la variante UNCHECKED (`usuario_id` plano y no `usuario: {connect}`)
    // porque es la única que admite `pago_reserva`/`pago_membresia` anidados en
    // la misma sentencia. Prisma no deja mezclar las dos: `PagoCreateInput` pide
    // la relación `usuario` y excluye `usuario_id`.
    const data: Prisma.PagoUncheckedCreateInput = {
      usuario_id: pago.usuario_id,
      idempotencia_key: pago.idempotencia_key,
      monto: new Prisma.Decimal(pago.monto),
      moneda: pago.moneda,
      token: pago.token,
      // Explícito y no por defecto: la decisión 7 del plan. `Pago.estado` no
      // tiene `@default` en el schema para que esto sea visible.
      estado: 'PENDIENTE',
      ...this.subtipoDe(pago),
    };

    try {
      const fila = await this.prisma.pago.create({
        data,
        include: { pago_reserva: true, pago_membresia: true },
      });

      return { ok: true, pago: this.aDominio(fila) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return {
          ok: false,
          motivo: this.motivoDe(error.meta),
        };
      }
      throw error;
    }
  }

  async buscarPorId(id: number): Promise<Pago | null> {
    const fila = await this.prisma.pago.findUnique({
      where: { id },
      include: { pago_reserva: true, pago_membresia: true },
    });

    return fila ? this.aDominio(fila) : null;
  }

  /**
   * Pasa el pago a ANULADO.
   *
   * El filtro por estado va en el WHERE del propio UPDATE (no en un `find`
   * previo): dos anulaciones simultáneas del mismo pago no pueden ganar las dos,
   * y el `P2025` se traduce a `null` con el mismo criterio que `cancelar` en M4.
   *
   * `PENDIENTE` y `APROBADO` son los anulables. `RECHAZADO` no aparece en el
   * filtro porque nunca se cobró (no hay nada que devolver) y `ANULADO` tampoco
   * porque la re-anulación la resuelve el service con un 204 idempotente.
   */
  async anular(pago: PagoAAnular): Promise<Pago | null> {
    try {
      const fila = await this.prisma.pago.update({
        where: { id: pago.id, estado: { in: ['PENDIENTE', 'APROBADO'] } },
        data: { estado: 'ANULADO' },
        include: { pago_reserva: true, pago_membresia: true },
      });

      return this.aDominio(fila);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  /**
   * El subtipo que corresponde al concepto. Es lo que materializa la herencia
   * parte-todo: exactamente uno de los dos, nunca los dos ni ninguno.
   */
  private subtipoDe(
    pago: PagoNuevo,
  ): Pick<Prisma.PagoUncheckedCreateInput, 'pago_reserva' | 'pago_membresia'> {
    return pago.concepto.tipo === 'RESERVA_CANCHA'
      ? { pago_reserva: { create: { reserva_id: pago.concepto.reserva_cancha_id } } }
      : { pago_membresia: { create: { membresia_id: pago.concepto.membresia_id } } };
  }

  /**
   * Qué `@unique` saltó. Prisma manda `meta.target` con el nombre de la constraint
   * o con la lista de campos según el motor, así que se mira de las dos formas en
   * vez de asumir una.
   *
   * El default es `IDEMPOTENCIA_REPETIDA` y no al revés a propósito: si someday
   * aparece un `@unique` nuevo, el 409 que sale es el que el contrato ya declara
   * para este endpoint, en vez de un motivo que nadie sabe traducir.
   */
  private motivoDe(meta: { target?: unknown } | undefined): 'IDEMPOTENCIA_REPETIDA' | 'RESERVA_YA_COBRADA' {
    const objetivo = meta?.target;
    const texto = Array.isArray(objetivo) ? objetivo.join(',') : String(objetivo ?? '');

    return texto.includes('reserva_id') ? 'RESERVA_YA_COBRADA' : 'IDEMPOTENCIA_REPETIDA';
  }

  private aDominio(fila: PagoConSubtipo): Pago {
    // La fila siempre viene con uno de los dos subtipos (los dos se crean anidados),
    // pero el tipo no lo sabe: si faltara, es una fila corrupta y se dice en vez
    // de devolver un concepto con id undefined que rompería el listado más lejos.
    if (fila.pago_reserva) {
      return {
        ...this.camposDe(fila),
        concepto: { tipo: 'RESERVA_CANCHA', reserva_cancha_id: fila.pago_reserva.reserva_id },
      };
    }

    if (fila.pago_membresia) {
      return {
        ...this.camposDe(fila),
        concepto: { tipo: 'MEMBRESIA', membresia_id: fila.pago_membresia.membresia_id },
      };
    }

    throw new Error(`El pago ${fila.id} no tiene subtipo: no corresponde a ningún concepto.`);
  }

  private camposDe(fila: PagoConSubtipo): Omit<Pago, 'concepto'> {
    return {
      id: fila.id,
      usuario_id: fila.usuario_id,
      monto: fila.monto.toNumber(),
      moneda: fila.moneda,
      estado: fila.estado,
      fecha_pago: fila.fecha_pago,
      comprobante_pdf_url: fila.comprobante_pdf_url,
      token: fila.token,
      idempotencia_key: fila.idempotencia_key,
    };
  }
}