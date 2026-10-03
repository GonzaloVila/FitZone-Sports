import { describe, expect, it, vi } from 'vitest';
import { ProblemDetails, ProblemException } from '../../../commons/filters/problem.exception';
import type { MembresiaPrecioService } from '../../m1-usuarios/services/membresia-precio.service';
import type { ReservaPrecioService } from '../../m4-canchas/services/reserva-precio.service';
import type { PagoIn } from '../dtos/pago-in.dto';
import type { Pago } from '../entities/pago.entity';
import type { PagoRepository } from '../repositories/pago.repository';
import type { PasarelaPagoService } from './pasarela-pago.service';
import { PagosService } from './pagos.service';

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
    reserva?: unknown;
    membresia?: unknown;
  } = {}) {
    const pagos = {
      crear: over.crear ?? vi.fn().mockResolvedValue({ ok: true, pago: pagoPersistido() }),
      transicionar: over.transicionar ?? vi.fn().mockResolvedValue(pagoPersistido({ estado: 'APROBADO' })),
    };
    const pasarela = {
      cobrar: over.cobrar ?? vi.fn().mockResolvedValue({ estado: 'APROBADO', pasarela_token: 'tok_aprobado_1' }),
    };
    const reservas = {
      obtenerParaCobro: vi.fn().mockResolvedValue(
        over.reserva === undefined ? { reserva_id: 7, usuario_id: 3, precio: 8000, estado: 'CONFIRMADA' } : over.reserva,
      ),
    };
    const membresias = {
      obtenerParaCobro: vi.fn().mockResolvedValue(
        over.membresia === undefined
          ? { membresia_id: 5, usuario_id: 3, plan: 'MENSUAL', precio: 30000, estado: 'ACTIVA' }
          : over.membresia,
      ),
    };

    const service = new PagosService(
      pagos as unknown as PagoRepository,
      pasarela as unknown as PasarelaPagoService,
      membresias as unknown as MembresiaPrecioService,
      reservas as unknown as ReservaPrecioService,
    );

    return { service, pagos, pasarela, reservas, membresias };
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
});