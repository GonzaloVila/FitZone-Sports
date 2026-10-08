import { describe, expect, it, vi } from 'vitest';
import { ProblemDetails, ProblemException } from 'src/commons/filters/problem.exception';
import type { MembresiaPrecioService } from 'src/modules/m1-usuarios/services/membresia-precio.service';
import type { ReservaClasePrecioService } from 'src/modules/m3-clases/services/reserva-clase-precio.service';
import type { ReservaPrecioService } from 'src/modules/m4-canchas/services/reserva-precio.service';
import type { PagoIn } from 'src/modules/m5-pagos/dtos/pago-in.dto';
import type { Pago } from 'src/modules/m5-pagos/entities/pago.entity';
import type { PagoRepository } from 'src/modules/m5-pagos/repositories/pago.repository';
import type { PasarelaPagoService } from 'src/modules/m5-pagos/services/pasarela-pago.service';
import type { ComprobantesService } from 'src/modules/m5-pagos/services/comprobantes.service';
import { PagosService } from 'src/modules/m5-pagos/services/pagos.service';

/**
 * Devuelve el CUERPO del problem+json, no la excepción.
 *
 * `toMatchObject({ status })` sobre el error parece funcionar y no: `status` es
 * una propiedad propia de `HttpException`, pero `detail`, `type` y `title` viven
 * adentro de `getResponse()`. Como el contrato justamente fija `type` y `title`,
 * hay que assertar lo que sale por el cable, que es lo que el `ProblemFilter`
 * termina serializando.
 */
async function cuerpoDe(promesa: Promise<unknown>): Promise<ProblemDetails> {
  const error = await promesa.then(
    () => null,
    (e: unknown) => e,
  );

  expect(error).toBeInstanceOf(ProblemException);
  return (error as ProblemException).getResponse() as ProblemDetails;
}

// Un pago ya persistido, como lo devuelve `PagoRepository.crear()`.
function pagoPersistido(over: Partial<Pago> = {}): Pago {
  return {
    id: 12,
    usuario_id: 3,
    concepto: { tipo: 'RESERVA_CANCHA', reserva_cancha_id: 7 },
    monto: 8000,
    moneda: 'ARS',
    estado: 'PENDIENTE',
    fecha_pago: new Date('2026-10-02T12:00:00Z'),
    comprobante_pdf_url: null,
    token: 'tok_aprobado_1',
    idempotencia_key: 'clave-1',
    ...over,
  };
}

function dtoDe(over: Partial<PagoIn> = {}): PagoIn {
  return {
    concepto: { tipo: 'RESERVA_CANCHA', reserva_cancha_id: 7, membresia_id: undefined },
    token: 'tok_aprobado_1',
    ...over,
  } as PagoIn;
}

describe('PagosService', () => {
  function armar(over: {
    crear?: ReturnType<typeof vi.fn>;
    cobrar?: ReturnType<typeof vi.fn>;
    transicionar?: ReturnType<typeof vi.fn>;
    registrarComprobante?: ReturnType<typeof vi.fn>;
    generar?: ReturnType<typeof vi.fn>;
    leer?: ReturnType<typeof vi.fn>;
    buscarPorId?: ReturnType<typeof vi.fn>;
    listar?: ReturnType<typeof vi.fn>;
    anular?: ReturnType<typeof vi.fn>;
    reembolsar?: ReturnType<typeof vi.fn>;
    reserva?: unknown;
    membresia?: unknown;
  } = {}) {
    const pagos = {
      crear: over.crear ?? vi.fn().mockResolvedValue({ ok: true, pago: pagoPersistido() }),
      transicionar: over.transicionar ?? vi.fn().mockResolvedValue(pagoPersistido({ estado: 'APROBADO' })),
      registrarComprobante:
        over.registrarComprobante ??
        vi.fn().mockResolvedValue(
          pagoPersistido({ estado: 'APROBADO', comprobante_pdf_url: '/storage/comprobantes/12.pdf' }),
        ),
      buscarPorId: over.buscarPorId ?? vi.fn().mockResolvedValue(pagoPersistido({ estado: 'APROBADO' })),
      listar: over.listar ?? vi.fn().mockResolvedValue([]),
      anular: over.anular ?? vi.fn().mockResolvedValue(pagoPersistido({ estado: 'ANULADO' })),
    };
    const pasarela = {
      cobrar: over.cobrar ?? vi.fn().mockResolvedValue({ estado: 'APROBADO', pasarela_token: 'tok_aprobado_1' }),
      reembolsar: over.reembolsar ?? vi.fn().mockResolvedValue({ ok: true }),
    };
    const reservas = {
      obtenerParaCobro: vi.fn().mockResolvedValue(
        over.reserva === undefined
          ? {
              reserva_id: 7,
              usuario_id: 3,
              cancha_id: 2,
              fecha_hora_inicio: new Date('2026-10-02T18:00:00Z'),
              fecha_hora_fin: new Date('2026-10-02T19:30:00Z'),
              precio: 8000,
              estado: 'CONFIRMADA',
            }
          : over.reserva,
      ),
    };
    const membresias = {
      obtenerParaCobro: vi.fn().mockResolvedValue(
        over.membresia === undefined
          ? { membresia_id: 5, usuario_id: 3, plan: 'MENSUAL', precio: 30000, estado: 'ACTIVA' }
          : over.membresia,
      ),
    };
    // RF-07: la penalidad de clase la resuelve M3 (ReservaClasePrecioService).
    const reservaClases = {
      obtenerParaCobro: vi.fn().mockResolvedValue(
        over.reservaClase === undefined
          ? {
              reserva_clase_id: 9,
              socio_id: 3,
              usuario_id: 3,
              clase_id: 4,
              horario: '2026-10-02T18:00:00Z',
              penalidad: 5000,
            }
          : over.reservaClase,
      ),
    };
    // El comprobante se aísla detrás de un mock: los tests de este archivo son sobre el
    // cobro, y escribir PDFs de verdad en `storage/` para cada caso los volvería
    // dependientes del disco. El armado del PDF tiene su propio spec.
    const comprobantes = {
      generar: over.generar ?? vi.fn().mockResolvedValue('/storage/comprobantes/12.pdf'),
      leer: over.leer ?? vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4\n')),
    };

    const service = new PagosService(
      pagos as unknown as PagoRepository,
      pasarela as unknown as PasarelaPagoService,
      membresias as unknown as MembresiaPrecioService,
      reservas as unknown as ReservaPrecioService,
      reservaClases as unknown as ReservaClasePrecioService,
      comprobantes as unknown as ComprobantesService,
    );

    return { service, pagos, pasarela, reservas, membresias, reservaClases, comprobantes };
  }

  describe('orden de los pasos', () => {
    it('inserta el pago ANTES de invocar a la pasarela', async () => {
      // Es lo que cierra la ventana de idempotencia: si el @unique salta, la
      // pasarela no llega a tocar. El orden se verifica con el invocationCallOrder
      // de vitest porque un mockResolvedValue no lo deja ver.
      const { service, pagos, pasarela } = armar();

      await service.procesarPago(dtoDe(), 'clave-1');

      expect(pagos.crear.mock.invocationCallOrder[0]).toBeLessThan(
        pasarela.cobrar.mock.invocationCallOrder[0],
      );
    });

    it('no llega a la pasarela si la clave ya se usó', async () => {
      const { service, pagos, pasarela } = armar({
        crear: vi.fn().mockResolvedValue({ ok: false, motivo: 'IDEMPOTENCIA_REPETIDA' }),
      });

      await expect(service.procesarPago(dtoDe(), 'clave-1')).rejects.toBeInstanceOf(ProblemException);
      expect(pasarela.cobrar).not.toHaveBeenCalled();
    });

    it('no inserta si el concepto no existe', async () => {
      const { service, pagos, pasarela } = armar({ reserva: null });

      const cuerpo = await cuerpoDe(service.procesarPago(dtoDe(), 'clave-1'));

      expect(cuerpo.status).toBe(404);
      expect(pagos.crear).not.toHaveBeenCalled();
      expect(pasarela.cobrar).not.toHaveBeenCalled();
    });
  });

  describe('monto', () => {
    it('copia el precio congelado de la reserva, sin recalcularlo', async () => {
      const { service, pagos } = armar();

      await service.procesarPago(dtoDe(), 'clave-1');

      expect(pagos.crear).toHaveBeenCalledWith(
        expect.objectContaining({ monto: 8000, usuario_id: 3 }),
      );
    });

    it('copia el precio de la membresía para el concepto MEMBRESIA', async () => {
      const { service, pagos, reservas } = armar();

      await service.procesarPago(
        dtoDe({ concepto: { tipo: 'MEMBRESIA', membresia_id: 5, reserva_cancha_id: undefined } }),
        'clave-1',
      );

      expect(reservas.obtenerParaCobro).not.toHaveBeenCalled();
      expect(pagos.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          monto: 30000,
          concepto: { tipo: 'MEMBRESIA', membresia_id: 5 },
        }),
      );
    });

    it('defaulta la moneda a ARS cuando el body no la manda', async () => {
      const { service, pagos } = armar();

      await service.procesarPago(dtoDe(), 'clave-1');

      expect(pagos.crear).toHaveBeenCalledWith(expect.objectContaining({ moneda: 'ARS' }));
    });
  });

  describe('traducción de errores', () => {
    it('404 con el detalle del recurso inexistente', async () => {
      const { service } = armar({ membresia: null });

      const cuerpo = await cuerpoDe(
        service.procesarPago(
          dtoDe({ concepto: { tipo: 'MEMBRESIA', membresia_id: 99, reserva_cancha_id: undefined } }),
          'clave-1',
        ),
      );

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toContain('99');
    });

    it('409 idempotencia-repetida con el type del contrato', async () => {
      const { service } = armar({
        crear: vi.fn().mockResolvedValue({ ok: false, motivo: 'IDEMPOTENCIA_REPETIDA' }),
      });

      const cuerpo = await cuerpoDe(service.procesarPago(dtoDe(), 'clave-1'));

      expect(cuerpo).toMatchObject({
        status: 409,
        type: 'https://fitzone.app/errores/idempotencia-repetida',
        title: 'Idempotency-Key repetida',
      });
    });

    it('409 reserva-ya-cobrada, que NO es idempotencia', async () => {
      const { service } = armar({
        crear: vi.fn().mockResolvedValue({ ok: false, motivo: 'RESERVA_YA_COBRADA' }),
      });

      const cuerpo = await cuerpoDe(service.procesarPago(dtoDe(), 'clave-1'));

      expect(cuerpo.status).toBe(409);
      // El detail tiene que nombrar la reserva y NO la clave: si reusara el texto de
      // idempotenciaRepetida() affirmaría una clave repetida que no es lo que pasó.
      expect(cuerpo.detail).toContain('7');
      expect(cuerpo.detail).not.toContain('clave-1');
    });
  });

  describe('ciclo del cobro', () => {
    it('persiste el pago antes de transicionar a APROBADO', async () => {
      const { service, pagos } = armar();

      const salida = await service.procesarPago(dtoDe(), 'clave-1');

      expect(pagos.transicionar).toHaveBeenCalledWith(12, 'APROBADO');
      expect(salida.estado).toBe('APROBADO');
      expect(salida.id).toBe(12);
    });

    it('deja PENDIENTE sin transicionar cuando la pasarela no resuelve', async () => {
      const { service, pagos } = armar({
        cobrar: vi.fn().mockResolvedValue({ estado: 'PENDIENTE', pasarela_token: 'tok_pendiente_1' }),
      });

      const salida = await service.procesarPago(dtoDe(), 'clave-1');

      expect(pagos.transicionar).not.toHaveBeenCalled();
      expect(salida.estado).toBe('PENDIENTE');
    });

    it('un rechazo responde 402 pero igual queda persistido como RECHAZADO', async () => {
      const { service, pagos } = armar({
        cobrar: vi.fn().mockResolvedValue({ estado: 'RECHAZADO', motivo: 'Fondos insuficientes' }),
        transicionar: vi.fn().mockResolvedValue(pagoPersistido({ estado: 'RECHAZADO' })),
      });

      const cuerpo = await cuerpoDe(service.procesarPago(dtoDe(), 'clave-1'));

      expect(cuerpo).toMatchObject({ status: 402, title: 'Pago rechazado', detail: 'Fondos insuficientes' });
      expect(pagos.transicionar).toHaveBeenCalledWith(12, 'RECHAZADO');
    });

    it('no expone el token ni la clave en la respuesta', async () => {
      const { service } = armar();

      const salida = await service.procesarPago(dtoDe(), 'clave-1');

      expect(salida).not.toHaveProperty('token');
      expect(salida).not.toHaveProperty('idempotencia_key');
    });
  });

  // RF-14: el comprobante se arma una vez, en el cobro, y solo si el pago quedó
  // APROBADO. Los tests del PDF en sí están en `comprobantes.service.spec.ts`; acá va
  // la decisión de CUÁNDO se llama.
  describe('comprobante', () => {
    it('genera el PDF y lo registra si el pago quedó APROBADO', async () => {
      const { service, comprobantes, pagos } = armar();

      const salida = await service.procesarPago(dtoDe(), 'clave-1');

      expect(comprobantes.generar).toHaveBeenCalledWith(
        expect.objectContaining({ id: 12, monto: 8000, estado: 'APROBADO' }),
        { tipo: 'RESERVA_CANCHA', reserva_cancha_id: 7 },
      );
      expect(pagos.registrarComprobante).toHaveBeenCalledWith(12, '/storage/comprobantes/12.pdf');
      // El 201 tiene que salir con la columna ya poblada: es lo que pide el smoke del
      // bloque 3 y lo que le permite al cliente sepa dónde buscar el PDF.
      expect(salida.comprobante_pdf_url).toBe('/storage/comprobantes/12.pdf');
    });

    it('no genera comprobante de un pago RECHAZADO', async () => {
      const { service, comprobantes } = armar({
        cobrar: vi.fn().mockResolvedValue({ estado: 'RECHAZADO', motivo: 'Sin fondos' }),
        transicionar: vi.fn().mockResolvedValue(pagoPersistido({ estado: 'RECHAZADO' })),
      });

      await cuerpoDe(service.procesarPago(dtoDe(), 'clave-1'));

      expect(comprobantes.generar).not.toHaveBeenCalled();
    });

    it('no genera comprobante de un pago que quedó PENDIENTE', async () => {
      const { service, comprobantes } = armar({
        cobrar: vi.fn().mockResolvedValue({ estado: 'PENDIENTE', pasarela_token: 'tok_pendiente_1' }),
      });

      const salida = await service.procesarPago(dtoDe(), 'clave-1');

      expect(comprobantes.generar).not.toHaveBeenCalled();
      expect(salida.comprobante_pdf_url).toBeNull();
    });

    it('arma el comprobante DESPUÉS de transicionar, no antes', async () => {
      const { service, pagos, comprobantes } = armar();

      await service.procesarPago(dtoDe(), 'clave-1');

      expect(pagos.transicionar.mock.invocationCallOrder[0]).toBeLessThan(
        comprobantes.generar.mock.invocationCallOrder[0],
      );
    });
  });

  describe('obtenerComprobante', () => {
    const conComprobante = (over: Partial<Pago> = {}) =>
      pagoPersistido({
        estado: 'APROBADO',
        comprobante_pdf_url: '/storage/comprobantes/12.pdf',
        ...over,
      });

    it('devuelve los bytes y un nombre para bajar', async () => {
      const buffer = Buffer.from('%PDF-1.4\ncontenido');
      const { service } = armar({
        buscarPorId: vi.fn().mockResolvedValue(conComprobante()),
        leer: vi.fn().mockResolvedValue(buffer),
      });

      const salida = await service.obtenerComprobante(12);

      expect(salida.buffer).toBe(buffer);
      expect(salida.nombre).toBe('comprobante-pago-12.pdf');
    });

    it('404 si el pago no existe', async () => {
      const { service } = armar({ buscarPorId: vi.fn().mockResolvedValue(null) });

      const cuerpo = await cuerpoDe(service.obtenerComprobante(999));

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toContain('999');
    });

    // El 409 va PRIMERO entre las razones por las que no se sirve, y el test lo fija con
    // los tres estados: el contrato responde igual para los tres, y un ANULADO tiene el
    // archivo en disco igual. Si algún día se sirve el del anulado, este test es el que
    // avisa de que se cambió el contrato.
    it.each(['PENDIENTE', 'RECHAZADO', 'ANULADO'])(
      '409 pago-no-aprobado si el pago está %s',
      async (estado) => {
        const { service, comprobantes } = armar({
          buscarPorId: vi.fn().mockResolvedValue(conComprobante({ estado: estado as Pago['estado'] })),
        });

        const cuerpo = await cuerpoDe(service.obtenerComprobante(12));

        expect(cuerpo).toMatchObject({ status: 409, title: 'Pago no aprobado' });
        expect(cuerpo.detail).toContain(estado);
        expect(comprobantes.leer).not.toHaveBeenCalled();
      },
    );

    it('404 si el pago está aprobado pero no tiene comprobante', async () => {
      const { service, comprobantes } = armar({
        buscarPorId: vi.fn().mockResolvedValue(conComprobante({ comprobante_pdf_url: null })),
      });

      const cuerpo = await cuerpoDe(service.obtenerComprobante(12));

      expect(cuerpo.status).toBe(404);
      expect(comprobantes.leer).not.toHaveBeenCalled();
    });

    it('404 si la columna apunta a un archivo que no está en disco', async () => {
      const { service } = armar({
        buscarPorId: vi.fn().mockResolvedValue(conComprobante()),
        leer: vi.fn().mockResolvedValue(null),
      });

      const cuerpo = await cuerpoDe(service.obtenerComprobante(12));

      expect(cuerpo.status).toBe(404);
    });
  });

  describe('listarPagos', () => {
    // El default del estado es la regla del módulo y no un detalle del DTO: sin
    // `?estado=` solo salen los APROBADO. El test la fija desde el service porque es
    // ahí donde vive; si alguien la mueve al repositorio, este test sigue marcando que
    // la regla tiene un dueño.
    it('sin estado devuelve solo APROBADO, no todos', async () => {
      const { service, pagos } = armar();

      await service.listarPagos({ page: 1, perPage: 20 });

      expect(pagos.listar).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'APROBADO' }),
        { page: 1, perPage: 20 },
      );
    });

    it('un estado pedido explícitamente pisa el default', async () => {
      const { service, pagos } = armar();

      await service.listarPagos({ estado: 'ANULADO', page: 1, perPage: 20 });

      expect(pagos.listar).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'ANULADO' }),
        expect.anything(),
      );
    });

    // El `hasta` inclusivo es el detalle que más fácil se implementa mal: si se pasa
    // como `lte` con la fecha tal cual, `?hasta=2026-03-31` corta a las 00:00 del 31 y
    // deja fuera todo ese día, que es justo el día que el contrato dice que entra.
    it('traduce desde/hasta a un rango semiabierto que incluye el último día', async () => {
      const { service, pagos } = armar();

      await service.listarPagos({ desde: '2026-03-01', hasta: '2026-03-31', page: 1, perPage: 20 });

      const [filtros] = pagos.listar.mock.calls[0] as [
        { desde?: Date; hasta?: Date },
        unknown,
      ];
      // Buenos Aires es UTC-3: el 1/3 arranca a las 03:00Z y el 1/4 (exclusive) también.
      expect(filtros.desde?.toISOString()).toBe('2026-03-01T03:00:00.000Z');
      expect(filtros.hasta?.toISOString()).toBe('2026-04-01T03:00:00.000Z');
    });

    it('deja el rango abierto si solo viene uno de los dos días', async () => {
      const { service, pagos } = armar();

      await service.listarPagos({ desde: '2026-03-01', page: 1, perPage: 20 });

      const [filtros] = pagos.listar.mock.calls[0] as [
        { desde?: Date; hasta?: Date },
        unknown,
      ];
      expect(filtros.desde?.toISOString()).toBe('2026-03-01T03:00:00.000Z');
      expect(filtros.hasta).toBeUndefined();
    });

    it('pasa los siete filtros y la paginación al repositorio', async () => {
      const { service, pagos } = armar();

      await service.listarPagos({
        usuarioId: 3,
        tipo: 'RESERVA_CANCHA',
        reservaCanchaId: 7,
        membresiaId: undefined,
        page: 3,
        perPage: 5,
      });

      expect(pagos.listar).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 3,
          tipo: 'RESERVA_CANCHA',
          reservaCanchaId: 7,
          membresiaId: undefined,
        }),
        { page: 3, perPage: 5 },
      );
    });

    it('mapea a PagoOut sin filtrar token ni idempotencia', async () => {
      const { service } = armar({
        listar: vi.fn().mockResolvedValue([
          pagoPersistido({ estado: 'APROBADO', comprobante_pdf_url: '/storage/comprobantes/12.pdf' }),
        ]),
      });

      const salida = await service.listarPagos({ page: 1, perPage: 20 });

      expect(salida).toHaveLength(1);
      expect(salida[0].id).toBe(12);
      expect(salida[0]).not.toHaveProperty('token');
      expect(salida[0]).not.toHaveProperty('idempotencia_key');
    });
  });

  describe('obtenerPago', () => {
    it('devuelve el pago sin token ni clave', async () => {
      const { service } = armar({ buscarPorId: vi.fn().mockResolvedValue(pagoPersistido()) });

      const salida = await service.obtenerPago(12);

      expect(salida.id).toBe(12);
      expect(salida).not.toHaveProperty('token');
      expect(salida).not.toHaveProperty('idempotencia_key');
    });

    it('404 si el pago no existe', async () => {
      const { service } = armar({ buscarPorId: vi.fn().mockResolvedValue(null) });

      const cuerpo = await cuerpoDe(service.obtenerPago(999));

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toContain('999');
    });
  });

  describe('anularPago', () => {
    it('404 si el pago no existe', async () => {
      const { service, pagos } = armar({ buscarPorId: vi.fn().mockResolvedValue(null) });

      const cuerpo = await cuerpoDe(service.anularPago(999));

      expect(cuerpo.status).toBe(404);
      expect(pagos.anular).not.toHaveBeenCalled();
    });

    it('anula un APROBADO y pide la devolución a la pasarela', async () => {
      const { service, pagos, pasarela } = armar({
        buscarPorId: vi.fn().mockResolvedValue(pagoPersistido({ estado: 'APROBADO' })),
      });

      await service.anularPago(12);

      expect(pagos.anular).toHaveBeenCalledWith(
        expect.objectContaining({ id: 12, token: 'tok_aprobado_1', monto: 8000, moneda: 'ARS' }),
      );
      expect(pasarela.reembolsar).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'tok_aprobado_1', monto: 8000 }),
      );
    });

    // Reanular es 204 idempotente y NO vuelve a tocar la pasarela: reembolsar un pago
    // ya devuelto devolvería el dinero dos veces.
    it('un ANULADO responde sin escribir y sin reembolsar otra vez', async () => {
      const { service, pagos, pasarela } = armar({
        buscarPorId: vi.fn().mockResolvedValue(pagoPersistido({ estado: 'ANULADO' })),
      });

      await expect(service.anularPago(12)).resolves.toBeUndefined();

      expect(pagos.anular).not.toHaveBeenCalled();
      expect(pasarela.reembolsar).not.toHaveBeenCalled();
    });

    // Un PENDIENTE nunca se cobró: se anula (para que no quede colgado esperando) pero no
    // se reembolsa, porque no hay contra qué devolver.
    it('un PENDIENTE se anula sin pedir devolución', async () => {
      const { service, pagos, pasarela } = armar({
        buscarPorId: vi.fn().mockResolvedValue(pagoPersistido({ estado: 'PENDIENTE' })),
      });

      await service.anularPago(12);

      expect(pagos.anular).toHaveBeenCalled();
      expect(pasarela.reembolsar).not.toHaveBeenCalled();
    });

    it('409 pago-no-anulable si el UPDATE no matcheó porque estaba RECHAZADO', async () => {
      const { service, pasarela } = armar({
        buscarPorId: vi.fn().mockResolvedValue(pagoPersistido({ estado: 'RECHAZADO' })),
        anular: vi.fn().mockResolvedValue(null),
      });

      const cuerpo = await cuerpoDe(service.anularPago(12));

      expect(cuerpo).toMatchObject({ status: 409, title: 'Pago no anulable' });
      expect(cuerpo.detail).toContain('RECHAZADO');
      expect(pasarela.reembolsar).not.toHaveBeenCalled();
    });

    // Si la devolución falla, el estado local ya cambió y no se puede volver atrás sin
    // mentir. El test fija que el error sube en vez de tragarse el fallo y devolver 204.
    it('sube el error si el pago se anuló pero la pasarela no devolvió', async () => {
      const { service } = armar({
        buscarPorId: vi.fn().mockResolvedValue(pagoPersistido({ estado: 'APROBADO' })),
        reembolsar: vi.fn().mockResolvedValue({ ok: false, motivo: 'la pasarela rechazó la devolución' }),
      });

      await expect(service.anularPago(12)).rejects.toThrow(/no devolvió el dinero/);
    });

    it('anula antes de pedir la devolución', async () => {
      const { service, pagos, pasarela } = armar({
        buscarPorId: vi.fn().mockResolvedValue(pagoPersistido({ estado: 'APROBADO' })),
      });

      await service.anularPago(12);

      expect(pagos.anular.mock.invocationCallOrder[0]).toBeLessThan(
        pasarela.reembolsar.mock.invocationCallOrder[0],
      );
    });
  });
});