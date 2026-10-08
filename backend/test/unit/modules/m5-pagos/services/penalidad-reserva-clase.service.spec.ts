import { describe, expect, it, vi } from 'vitest';
import { penalidadCancelacionTardia } from 'src/modules/m3-clases/entities/reserva-clase.entity';
import type { ReservaClasePrecioService } from 'src/modules/m3-clases/services/reserva-clase-precio.service';
import type { PagoRepository } from 'src/modules/m5-pagos/repositories/pago.repository';
import type { ComprobantesService } from 'src/modules/m5-pagos/services/comprobantes.service';
import type { PasarelaPagoService } from 'src/modules/m5-pagos/services/pasarela-pago.service';
import { PenalidadReservaClaseService } from 'src/modules/m5-pagos/services/penalidad-reserva-clase.service';

// RF-07: cobro interno de la penalidad por cancelacion tardia de clase. Mismo
// criterio que RenovacionesService (RF-02): se cobra PRIMERO con la pasarela y
// solo se inserta el Pago si aprobó, porque la cancelacion es consecuencia del
// pago — un rechazo tiene que dejar la reserva confirmada.

function pago(estado: 'PENDIENTE' | 'APROBADO' = 'PENDIENTE') {
  return {
    id: 1,
    usuario_id: 7,
    concepto: { tipo: 'RESERVA_CLASE' as const, reserva_clase_id: 3 },
    monto: penalidadCancelacionTardia(),
    moneda: 'ARS',
    estado,
    fecha_pago: new Date('2026-10-10T14:05:00.000Z'),
    comprobante_pdf_url: null as string | null,
    token: 'tok_aprobado_1',
    idempotencia_key: 'penalidad-clase-3',
  };
}

const DATOS_CLASE = {
  reserva_clase_id: 3,
  socio_id: 42,
  usuario_id: 7,
  clase_id: 9,
  horario: '2026-10-10T14:00:00.000Z',
  penalidad: penalidadCancelacionTardia(),
};

function armar(over: Record<string, unknown> = {}) {
  const reservaClases = {
    obtenerParaCobro: vi.fn().mockResolvedValue(over.datosClase ?? DATOS_CLASE),
  };
  const pasarela = {
    cobrar:
      over.cobrar ??
      vi.fn().mockResolvedValue({ estado: 'APROBADO', pasarela_token: 'tok_aprobado_1' }),
  };
  const pagos = {
    crear:
      over.crear ?? vi.fn().mockResolvedValue({ ok: true, pago: pago() }),
    transicionar:
      over.transicionar ?? vi.fn().mockResolvedValue(pago('APROBADO')),
    registrarComprobante: vi.fn().mockResolvedValue(pago('APROBADO')),
    buscarPorIdempotenciaKey:
      over.buscarPorIdempotenciaKey ?? vi.fn().mockResolvedValue(null),
  };
  const comprobantes = {
    generar: over.generar ?? vi.fn().mockResolvedValue('/storage/comprobantes/1.pdf'),
  };

  const service = new PenalidadReservaClaseService(
    pagos as unknown as PagoRepository,
    pasarela as unknown as PasarelaPagoService,
    comprobantes as unknown as ComprobantesService,
    reservaClases as unknown as ReservaClasePrecioService,
  );
  return { service, pagos, pasarela, comprobantes, reservaClases };
}

describe('PenalidadReservaClaseService (RF-07)', () => {
  it('cobra primero y solo inserta el Pago si la pasarela aprobó', async () => {
    const { service, pasarela, pagos } = armar();

    const resultado = await service.cobrarPenalidad({ reserva_clase_id: 3 }, 'penalidad-clase-3');

    expect(pasarela.cobrar).toHaveBeenCalledTimes(1);
    expect(pagos.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: 7,
        concepto: { tipo: 'RESERVA_CLASE', reserva_clase_id: 3 },
        monto: penalidadCancelacionTardia(),
        idempotencia_key: 'penalidad-clase-3',
      }),
    );
    expect(resultado.estado).toBe('APROBADO');
  });

  it('un rechazo de la pasarela propaga el error sin crear ningún pago', async () => {
    const { service, pagos } = armar({
      cobrar: vi.fn().mockResolvedValue({ estado: 'RECHAZADO', motivo: 'Fondos insuficientes' }),
    });

    await expect(service.cobrarPenalidad({ reserva_clase_id: 3 }, 'k')).rejects.toThrow();
    expect(pagos.crear).not.toHaveBeenCalled();
  });

  it('reintentando con la misma clave devuelve el pago existente (no cobra dos veces)', async () => {
    const existente = pago('APROBADO');
    const { service, pagos } = armar({
      crear: vi.fn().mockResolvedValue({ ok: false, motivo: 'IDEMPOTENCIA_REPETIDA' }),
      buscarPorIdempotenciaKey: vi.fn().mockResolvedValue(existente),
    });

    const resultado = await service.cobrarPenalidad({ reserva_clase_id: 3 }, 'penalidad-clase-3');

    expect(pagos.crear).toHaveBeenCalledTimes(1);
    expect(resultado.id).toBe(1);
  });
});