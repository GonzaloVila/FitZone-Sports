import { describe, expect, it, vi } from 'vitest';
import { penalidadCancelacionTardia } from 'src/modules/m3-clases/entities/reserva-clase.entity';
import type { ReservaClasePrecioService } from 'src/modules/m3-clases/services/reserva-clase-precio.service';
import type { CobroInternoService } from 'src/modules/m5-pagos/services/cobro-interno.service';
import { PenalidadReservaClaseService } from 'src/modules/m5-pagos/services/penalidad-reserva-clase.service';

// RF-07: el wrapper de la penalidad de clase resuelve el concepto y el importe (dato de
// M3) y delega el flujo en CobroInternoService. El flujo en sí (cobrar primero,
// idempotencia, comprobante) se prueba en cobro-interno.service.spec.ts.

const DATOS_CLASE = {
  reservaClaseId: 3,
  socioId: 42,
  usuarioId: 7,
  claseId: 9,
  horarioInicio: '2026-10-10T14:00:00.000Z',
  penalidad: penalidadCancelacionTardia(),
};

function armar(over: Record<string, unknown> = {}) {
  const reservaClases = {
    obtenerParaCobro: vi.fn().mockResolvedValue(over.datosClase === undefined ? DATOS_CLASE : over.datosClase),
  };
  const cobroInterno = {
    cobrar: over.cobrar ?? vi.fn().mockResolvedValue({ id: 1, estado: 'APROBADO' }),
  };

  const service = new PenalidadReservaClaseService(
    cobroInterno as unknown as CobroInternoService,
    reservaClases as unknown as ReservaClasePrecioService,
  );
  return { service, cobroInterno, reservaClases };
}

describe('PenalidadReservaClaseService (RF-07)', () => {
  it('resuelve el concepto/importe vía M3 y delega en CobroInternoService', async () => {
    const { service, cobroInterno } = armar();

    const resultado = await service.cobrarPenalidad({ reservaClaseId: 3 }, 'penalidad-clase-3');

    expect(cobroInterno.cobrar).toHaveBeenCalledWith(
      { tipo: 'RESERVA_CLASE', reservaClaseId: 3 },
      { usuarioId: 7, monto: penalidadCancelacionTardia(), token: 'tok_aprobado_penalidad' },
      'penalidad-clase-3',
    );
    expect(resultado).toEqual({ id: 1, estado: 'APROBADO' });
  });

  it('404 si la reserva de clase no existe, sin llamar al cobro', async () => {
    const { service, cobroInterno } = armar({ datosClase: null });

    await expect(service.cobrarPenalidad({ reservaClaseId: 3 }, 'k')).rejects.toThrow();
    expect(cobroInterno.cobrar).not.toHaveBeenCalled();
  });
});
