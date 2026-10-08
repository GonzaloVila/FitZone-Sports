import { describe, expect, it, vi } from 'vitest';
import { penalidadCancelacionTardia } from 'src/modules/m3-clases/entities/reserva-clase.entity';
import type { ClaseRepository } from 'src/modules/m3-clases/repositories/clase.repository';
import type { ReservaClaseRepository } from 'src/modules/m3-clases/repositories/reserva-clase.repository';
import { ReservaClasePrecioService } from 'src/modules/m3-clases/services/reserva-clase-precio.service';
import type { SociosService } from 'src/modules/m1-usuarios/services/socios.service';

// RF-07: el importe de la penalidad por cancelacion tardia. M5 importa este service
// (es lo unico que M3 exporta) para resolver la reserva + clase + usuario del socio.

describe('ReservaClasePrecioService (RF-07)', () => {
  function armar(over: { reserva?: unknown; clase?: unknown; usuario?: unknown } = {}) {
    const reservas = {
      buscarPorId: vi
        .fn()
        .mockResolvedValue(
          over.reserva ?? { id: 3, clase_id: 9, socio_id: 42, estado: 'CONFIRMADA' },
        ),
    };
    const clases = {
      buscarPorId: vi
        .fn()
        .mockResolvedValue(over.clase ?? { id: 9, horario: '2026-10-10T14:00:00.000Z' }),
    };
    const socios = {
      obtenerUsuarioIdPorSocio: vi.fn().mockResolvedValue(over.usuario ?? 7),
    };

    const service = new ReservaClasePrecioService(
      reservas as unknown as ReservaClaseRepository,
      clases as unknown as ClaseRepository,
      socios as unknown as SociosService,
    );
    return { service, reservas, clases, socios };
  }

  it('resuelve el cobro con horario, usuario del socio y la penalidad de dominio', async () => {
    const { service } = armar();

    const r = await service.obtenerParaCobro(3);

    expect(r).toEqual({
      reserva_clase_id: 3,
      socio_id: 42,
      usuario_id: 7,
      clase_id: 9,
      horario: '2026-10-10T14:00:00.000Z',
      penalidad: penalidadCancelacionTardia(),
    });
  });

  it('null si la reserva de clase no existe', async () => {
    const { service, reservas } = armar();
    reservas.buscarPorId.mockResolvedValue(null);

    expect(await service.obtenerParaCobro(999)).toBeNull();
  });

  it('null si la clase de la reserva no existe', async () => {
    const { service, clases } = armar();
    clases.buscarPorId.mockResolvedValue(null);

    expect(await service.obtenerParaCobro(3)).toBeNull();
  });
});