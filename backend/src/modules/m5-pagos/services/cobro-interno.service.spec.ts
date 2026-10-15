import { describe, expect, it, vi } from 'vitest';
import type { PagoRepository } from 'src/modules/m5-pagos/repositories/pago.repository';
import type { ComprobantesService } from 'src/modules/m5-pagos/services/comprobantes.service';
import type { PasarelaPagoService } from 'src/modules/m5-pagos/services/pasarela-pago.service';
import { CobroInternoService } from 'src/modules/m5-pagos/services/cobro-interno.service';

// Flujo COMÚN del cobro interno de M5 (RF-02 membresía y RF-07 penalidad de clase):
// cobrar → crear → idempotencia → transicionar → comprobante. Los wrappers
// (RenovacionesService y PenalidadReservaClaseService) solo resuelven el concepto y
// delegan acá, así que el flujo se prueba UNA vez, en este spec.

function pago(estado: 'PENDIENTE' | 'APROBADO' = 'PENDIENTE', comprobantePdfUrl: string | null = null) {
  return {
    id: 1,
    usuarioId: 7,
    concepto: { tipo: 'RESERVA_CLASE' as const, reservaClaseId: 3 },
    monto: 5000,
    moneda: 'ARS',
    estado,
    fechaPago: new Date('2026-10-10T14:05:00.000Z'),
    comprobantePdfUrl,
    token: 'tok_aprobado_1',
    idempotenciaKey: 'penalidad-clase-3',
  };
}

const CONCEPTO = { tipo: 'RESERVA_CLASE' as const, reservaClaseId: 3 };
const COBRO = { usuarioId: 7, monto: 5000, token: 'tok_aprobado_penalidad' };

function armar(over: Record<string, unknown> = {}) {
  const pagos = {
    crear: over.crear ?? vi.fn().mockResolvedValue({ ok: true, pago: pago() }),
    transicionar: over.transicionar ?? vi.fn().mockResolvedValue(pago('APROBADO')),
    registrarComprobante:
      over.registrarComprobante ?? vi.fn().mockResolvedValue(pago('APROBADO', '/storage/comprobantes/1.pdf')),
    buscarPorIdempotenciaKey: over.buscarPorIdempotenciaKey ?? vi.fn().mockResolvedValue(null),
  };
  const pasarela = {
    cobrar:
      over.cobrar ??
      vi.fn().mockResolvedValue({ estado: 'APROBADO', pasarelaToken: 'tok_aprobado_1' }),
  };
  const comprobantes = {
    generar: over.generar ?? vi.fn().mockResolvedValue('/storage/comprobantes/1.pdf'),
  };

  const service = new CobroInternoService(
    pagos as unknown as PagoRepository,
    pasarela as unknown as PasarelaPagoService,
    comprobantes as unknown as ComprobantesService,
  );
  return { service, pagos, pasarela, comprobantes };
}

describe('CobroInternoService (RF-02 / RF-07)', () => {
  it('cobra primero y solo inserta el Pago si la pasarela aprobó', async () => {
    const { service, pasarela, pagos } = armar();

    const resultado = await service.cobrar(CONCEPTO, COBRO, 'penalidad-clase-3');

    expect(pasarela.cobrar).toHaveBeenCalledTimes(1);
    expect(pagos.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 7,
        concepto: CONCEPTO,
        monto: 5000,
        idempotenciaKey: 'penalidad-clase-3',
      }),
    );
    expect(resultado.estado).toBe('APROBADO');
  });

  it('un rechazo de la pasarela propaga el error sin crear ningún pago', async () => {
    const { service, pagos } = armar({
      cobrar: vi.fn().mockResolvedValue({ estado: 'RECHAZADO', motivo: 'Fondos insuficientes' }),
    });

    await expect(service.cobrar(CONCEPTO, COBRO, 'k')).rejects.toThrow();
    expect(pagos.crear).not.toHaveBeenCalled();
  });

  it('un PENDIENTE también lanza 402 sin crear pago (el flujo interno es síncrono)', async () => {
    const { service, pagos } = armar({
      cobrar: vi.fn().mockResolvedValue({ estado: 'PENDIENTE', pasarelaToken: 'tok' }),
    });

    await expect(service.cobrar(CONCEPTO, COBRO, 'k')).rejects.toThrow();
    expect(pagos.crear).not.toHaveBeenCalled();
  });

  it('reintentando con la misma clave devuelve el pago existente (no cobra dos veces)', async () => {
    const existente = pago('APROBADO');
    const { service, pagos } = armar({
      crear: vi.fn().mockResolvedValue({ ok: false, motivo: 'IDEMPOTENCIA_REPETIDA' }),
      buscarPorIdempotenciaKey: vi.fn().mockResolvedValue(existente),
    });

    const resultado = await service.cobrar(CONCEPTO, COBRO, 'penalidad-clase-3');

    expect(pagos.crear).toHaveBeenCalledTimes(1);
    expect(resultado.id).toBe(1);
  });

  it('emite el comprobante una sola vez, tras dejar el pago APROBADO', async () => {
    const { service, comprobantes, pagos } = armar();

    await service.cobrar(CONCEPTO, COBRO, 'k');

    expect(pagos.transicionar).toHaveBeenCalledWith(1, 'APROBADO');
    expect(comprobantes.generar).toHaveBeenCalledTimes(1);
    expect(pagos.registrarComprobante).toHaveBeenCalledTimes(1);
  });
});
