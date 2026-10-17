import { expect, vi } from 'vitest';
import { ProblemDetails, ProblemException } from 'src/commons/filters/problem.exception';
import type { MembresiaPrecioService } from 'src/modules/m1-usuarios/services/membresia-precio.service';
import type { ReservaClasePrecioService } from 'src/modules/m3-clases/services/reserva-clase-precio.service';
import type { ReservaPrecioService } from 'src/modules/m4-canchas/services/reserva-precio.service';
import type { PagoIn } from 'src/modules/m5-pagos/dtos/pago-in.dto';
import type { Pago } from 'src/modules/m5-pagos/entities/pago.entity';
import type { PagoRepository } from 'src/modules/m5-pagos/repositories/pago.repository';
import type { ComprobantesService } from 'src/modules/m5-pagos/services/comprobantes.service';
import type { PasarelaPagoService } from 'src/modules/m5-pagos/services/pasarela-pago.service';
import { PagosService } from 'src/modules/m5-pagos/services/pagos.service';

// Fixtures compartidos por los specs de PagosService (antes en pagos.service.spec.ts).

/**
 * Devuelve el CUERPO del problem+json, no la excepcion. `status` es propio de
 * HttpException, pero `detail`/`type`/`title` viven en `getResponse()`.
 */
export async function cuerpoDe(promesa: Promise<unknown>): Promise<ProblemDetails> {
  const error = await promesa.then(
    () => null,
    (e: unknown) => e,
  );

  expect(error).toBeInstanceOf(ProblemException);
  return (error as ProblemException).getResponse() as ProblemDetails;
}

// Un pago ya persistido, como lo devuelve `PagoRepository.crear()`.
export function pagoPersistido(over: Partial<Pago> = {}): Pago {
  return {
    id: 12,
    usuarioId: 3,
    concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: 7 },
    monto: 8000,
    moneda: 'ARS',
    estado: 'PENDIENTE',
    fechaPago: new Date('2026-10-02T12:00:00Z'),
    comprobantePdfUrl: null,
    token: 'tok_aprobado_1',
    idempotenciaKey: 'clave-1',
    ...over,
  };
}

export function dtoDe(over: Partial<PagoIn> = {}): PagoIn {
  return {
    concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: 7, membresiaId: undefined },
    token: 'tok_aprobado_1',
    ...over,
  } as PagoIn;
}

export function armar(
  over: {
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
    reservaClase?: unknown;
  } = {},
) {
  const pagos = {
    crear: over.crear ?? vi.fn().mockResolvedValue({ ok: true, pago: pagoPersistido() }),
    transicionar: over.transicionar ?? vi.fn().mockResolvedValue(pagoPersistido({ estado: 'APROBADO' })),
    registrarComprobante:
      over.registrarComprobante ??
      vi.fn().mockResolvedValue(
        pagoPersistido({ estado: 'APROBADO', comprobantePdfUrl: '/storage/comprobantes/12.pdf' }),
      ),
    buscarPorId: over.buscarPorId ?? vi.fn().mockResolvedValue(pagoPersistido({ estado: 'APROBADO' })),
    listar: over.listar ?? vi.fn().mockResolvedValue({ items: [], total: 0 }),
    anular: over.anular ?? vi.fn().mockResolvedValue(pagoPersistido({ estado: 'ANULADO' })),
  };
  const pasarela = {
    cobrar: over.cobrar ?? vi.fn().mockResolvedValue({ estado: 'APROBADO', pasarelaToken: 'tok_aprobado_1' }),
    reembolsar: over.reembolsar ?? vi.fn().mockResolvedValue({ ok: true }),
  };
  const reservas = {
    obtenerParaCobro: vi.fn().mockResolvedValue(
      over.reserva === undefined
        ? {
            reservaId: 7,
            usuarioId: 3,
            canchaId: 2,
            fechaHoraInicio: new Date('2026-10-02T18:00:00Z'),
            fechaHoraFin: new Date('2026-10-02T19:30:00Z'),
            precio: 8000,
            estado: 'CONFIRMADA',
          }
        : over.reserva,
    ),
  };
  const membresias = {
    obtenerParaCobro: vi.fn().mockResolvedValue(
      over.membresia === undefined
        ? { membresiaId: 5, usuarioId: 3, plan: 'MENSUAL', precio: 30000, estado: 'ACTIVA' }
        : over.membresia,
    ),
  };
  const reservaClases = {
    obtenerParaCobro: vi.fn().mockResolvedValue(
      over.reservaClase === undefined
        ? {
            reservaClaseId: 9,
            socioId: 3,
            usuarioId: 3,
            claseId: 4,
            horarioInicio: '2026-10-02T18:00:00Z',
            penalidad: 5000,
          }
        : over.reservaClase,
    ),
  };
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
