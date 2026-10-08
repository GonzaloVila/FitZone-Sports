import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import { ConceptoPago, Pago, PagoAAnular, PagoNuevo } from '../entities/pago.entity';

// Lista blanca de filtros de `GET /pagos`. El repositorio NO decide defaults: el del
// `estado` (sin el parámetro solo salen los APROBADO) es regla de negocio y lo aplica
// el service. `desde`/`hasta` llegan ya traducidos a instantes por el service, igual
// que en el listado de reservas de M4.
export interface FiltrosListarPagos {
  usuarioId?: number;
  estado?: Pago['estado'];
  tipo?: ConceptoPago['tipo'];
  reservaCanchaId?: number;
  membresiaId?: number;
  reservaClaseId?: number;
  desde?: Date;
  hasta?: Date;
}

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
  include: { pago_reserva: true; pago_membresia: true; pago_reserva_clase: true };
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
      usuario_id: pago.usuarioId,
      idempotencia_key: pago.idempotenciaKey,
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
        include: { pago_reserva: true, pago_membresia: true, pago_reserva_clase: true },
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
      include: { pago_reserva: true, pago_membresia: true, pago_reserva_clase: true },
    });

    return fila ? this.aDominio(fila) : null;
  }

  // Para el cobro interno (renovaciones.service): cuando el @unique de
  // idempotenciaKey salta, el cobro ya existe con esa clave (pasarela idempotente)
  // y hay que devolver el pago original en vez de reintentar o fallar. La clave es
  // privada del Pago, así que esta búsqueda vive acá, donde el repositorio sí la ve.
  async buscarPorIdempotenciaKey(idempotenciaKey: string): Promise<Pago | null> {
    const fila = await this.prisma.pago.findUnique({
      where: { idempotencia_key: idempotenciaKey },
      include: { pago_reserva: true, pago_membresia: true, pago_reserva_clase: true },
    });

    return fila ? this.aDominio(fila) : null;
  }

  /**
   * El listado de pagos, con la lista blanca de filtros del contrato.
   *
   * Dos detalles que no son obvios:
   *
   *  1. `reserva_cancha_id` y `membresia_id` se filtran por RELACIÓN, no por una
   *     columna del `Pago`. El id del concepto vive en la tabla del subtipo (decisión 3:
   *     la herencia es parte-todo y el `id` está en el subtipo, no en `Pago`), así que
   *     el filtro es `pago_reserva: { reserva_id: X }`. Cada subtipo existe como máximo
   *     una vez por pago, así que el filtro es 1-a-1 y no necesita `some`.
   *
   *  2. El `orderBy` desempata por `id` porque `fecha_pago` no es única: dos pagos del
   *     mismo lote comparten el instante y, sin un orden total, `skip`/`take` repite
   *     filas entre páginas y deja paginar inconsistente. Es el mismo criterio que el
   *     listado de reservas de M4.
   */
  async listar(
    filtros: FiltrosListarPagos,
    { page, perPage }: OpcionesPaginacion,
  ): Promise<Pago[]> {
    const where: Prisma.PagoWhereInput = {
      ...(filtros.usuarioId !== undefined && { usuario_id: filtros.usuarioId }),
      ...(filtros.estado !== undefined && { estado: filtros.estado }),
      ...(filtros.reservaCanchaId !== undefined && {
        pago_reserva: { reserva_id: filtros.reservaCanchaId },
      }),
      ...(filtros.membresiaId !== undefined && {
        pago_membresia: { membresia_id: filtros.membresiaId },
      }),
      ...(filtros.reservaClaseId !== undefined && {
        pago_reserva_clase: { reserva_clase_id: filtros.reservaClaseId },
      }),
      ...((filtros.desde !== undefined || filtros.hasta !== undefined) && {
        fecha_pago: {
          ...(filtros.desde !== undefined && { gte: filtros.desde }),
          ...(filtros.hasta !== undefined && { lt: filtros.hasta }),
        },
      }),
    };

    // `tipo` es el discriminante del `oneOf` de `ConceptoPago`: RESERVA_CANCHA cruza con
    // PagoReserva, MEMBRESIA con PagoMembresia y RESERVA_CLASE con PagoReservaClase. Se
    // traduce a "tiene este subtipo" con un AND de is-null sobre los otros dos, porque en
    // la base la ausencia de subtipo es la fila en NULL y no un discriminante
    // materializado: preguntar por `tipo` solo, sin los `is`, traería también los pagos de
    // los otros tipos, que es exactamente el error que el filtro existe para evitar.
    if (filtros.tipo !== undefined) {
      where.AND =
        filtros.tipo === 'RESERVA_CANCHA'
          ? {
              pago_reserva: { isNot: null },
              pago_membresia: { is: null },
              pago_reserva_clase: { is: null },
            }
          : filtros.tipo === 'RESERVA_CLASE'
            ? {
                pago_reserva_clase: { isNot: null },
                pago_reserva: { is: null },
                pago_membresia: { is: null },
              }
            : {
                pago_membresia: { isNot: null },
                pago_reserva: { is: null },
                pago_reserva_clase: { is: null },
              };
    }

    const filas = await this.prisma.pago.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: [{ fecha_pago: 'desc' }, { id: 'desc' }],
      include: { pago_reserva: true, pago_membresia: true, pago_reserva_clase: true },
    });

    return filas.map((fila) => this.aDominio(fila));
  }

  /**
   * Transición de estado después de que la pasarela respondió. Es la única forma de
   * mover un pago de `PENDIENTE` a su estado final: el insert siempre arranca en
   * `PENDIENTE` y lo que decide la pasarela se escribe después (decisión 7).
   *
   * `ANULADO` NO se escribe por acá: pasa por `anular()`, que además filtra los
   * estados anulables en el propio UPDATE. Si esta puerta aceptara `ANULADO` en
   * cualquier momento, la idempotencia del 204 y el 409 del RECHAZADO quedarían
   * decididos en el service y no en la base.
   */
  async transicionar(id: number, estado: 'APROBADO' | 'RECHAZADO'): Promise<Pago> {
    const fila = await this.prisma.pago.update({
      where: { id },
      data: { estado },
      include: { pago_reserva: true, pago_membresia: true, pago_reserva_clase: true },
    });

    return this.aDominio(fila);
  }

  /**
   * Guarda dónde quedó el PDF del comprobante (RF-14).
   *
   * Es un UPDATE aparte y no parte de `transicionar()` a propósito: el estado y la
   * ubicación del archivo son dos hechos que se wissen en momentos distintos. El
   * estado se escribe apenas la pasarela contesta; el comprobante se arma después, y
   * si el armado fallara el pago tiene que quedar APROBADO igual — con un cobro
   * aprobado y sin comprobante es un problema real, pero un cobro APROBADO que se
   * perdió porque falló la escritura de un archivo sería peor: el dinero ya se movió.
   *
   * Devuelve el pago entero y no un void para que el 201 de `POST /pagos` salga con
   * `comprobante_pdf_url` ya poblado, que es lo que pide el smoke del bloque 3.
   */
  async registrarComprobante(id: number, comprobantePdfUrl: string): Promise<Pago> {
    const fila = await this.prisma.pago.update({
      where: { id },
      data: { comprobante_pdf_url: comprobantePdfUrl },
      include: { pago_reserva: true, pago_membresia: true, pago_reserva_clase: true },
    });

    return this.aDominio(fila);
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
        include: { pago_reserva: true, pago_membresia: true, pago_reserva_clase: true },
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
  ): Pick<
    Prisma.PagoUncheckedCreateInput,
    'pago_reserva' | 'pago_membresia' | 'pago_reserva_clase'
  > {
    switch (pago.concepto.tipo) {
      case 'RESERVA_CANCHA':
        return { pago_reserva: { create: { reserva_id: pago.concepto.reservaCanchaId } } };
      case 'MEMBRESIA':
        return { pago_membresia: { create: { membresia_id: pago.concepto.membresiaId } } };
      case 'RESERVA_CLASE':
        return {
          pago_reserva_clase: { create: { reserva_clase_id: pago.concepto.reservaClaseId } },
        };
    }
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

    // Las dos únicas FKs únicas de los subtipos (cancha y clase) significan "esta
    // reserva ya fue cobrada"; la de membresía no es única a propósito. La de
    // clase no contiene el substring `reserva_id`, por eso se mira por separado.
    return texto.includes('reserva_id') || texto.includes('reserva_clase_id')
      ? 'RESERVA_YA_COBRADA'
      : 'IDEMPOTENCIA_REPETIDA';
  }

  private aDominio(fila: PagoConSubtipo): Pago {
    // La fila siempre viene con uno de los dos subtipos (los dos se crean anidados),
    // pero el tipo no lo sabe: si faltara, es una fila corrupta y se dice en vez
    // de devolver un concepto con id undefined que rompería el listado más lejos.
    if (fila.pago_reserva) {
      return {
        ...this.camposDe(fila),
        concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: fila.pago_reserva.reserva_id },
      };
    }

    if (fila.pago_membresia) {
      return {
        ...this.camposDe(fila),
        concepto: { tipo: 'MEMBRESIA', membresiaId: fila.pago_membresia.membresia_id },
      };
    }

    if (fila.pago_reserva_clase) {
      return {
        ...this.camposDe(fila),
        concepto: {
          tipo: 'RESERVA_CLASE',
          reservaClaseId: fila.pago_reserva_clase.reserva_clase_id,
        },
      };
    }

    throw new Error(`El pago ${fila.id} no tiene subtipo: no corresponde a ningún concepto.`);
  }

  private camposDe(fila: PagoConSubtipo): Omit<Pago, 'concepto'> {
    return {
      id: fila.id,
      usuarioId: fila.usuario_id,
      monto: fila.monto.toNumber(),
      moneda: fila.moneda,
      estado: fila.estado,
      fechaPago: fila.fecha_pago,
      comprobantePdfUrl: fila.comprobante_pdf_url,
      token: fila.token,
      idempotenciaKey: fila.idempotencia_key,
    };
  }
}