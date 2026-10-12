import { describe, expect, it, vi } from 'vitest';
import type { PagoParaReporte } from 'src/modules/m5-pagos/entities/pago.entity';
import type { PagoRepository } from 'src/modules/m5-pagos/repositories/pago.repository';
import { ReporteIngresosService } from 'src/modules/m5-pagos/services/reporte-ingresos.service';

const CENTRO = { id: 1, nombre: 'Sede Centro' };
const NORTE = { id: 2, nombre: 'Sede Norte' };

// 2026-10-08 12:00 hora local (UTC-3) = 15:00Z.
const DIA_8 = new Date('2026-10-08T15:00:00.000Z');

function pago(over: Partial<PagoParaReporte> = {}): PagoParaReporte {
  return { tipo: 'RESERVA_CANCHA', monto: 7750, fechaPago: DIA_8, sede: CENTRO, ...over };
}

function armar(pagos: PagoParaReporte[]) {
  const listarAprobadosConSede = vi.fn().mockResolvedValue(pagos);
  const service = new ReporteIngresosService({ listarAprobadosConSede } as unknown as PagoRepository);
  return { service, listarAprobadosConSede };
}

describe('ReporteIngresosService', () => {
  it('pide solo los aprobados del rango al repositorio', async () => {
    const { service, listarAprobadosConSede } = armar([]);
    const desde = new Date('2026-10-08T03:00:00.000Z');
    const hasta = new Date('2026-10-09T03:00:00.000Z');

    const reporte = await service.consolidadoPagos({ desde, hasta });

    expect(listarAprobadosConSede).toHaveBeenCalledWith({ desde, hasta });
    expect(reporte).toEqual({ filas: [], total: 0, huerfanos: 0 });
  });

  it('agrupa por día local, sede y tipo, sumando los montos', async () => {
    const { service } = armar([
      pago({ monto: 5000 }),
      pago({ monto: 2750 }),
      pago({ tipo: 'MEMBRESIA', monto: 30000 }),
      pago({ tipo: 'RESERVA_CLASE', monto: 5000, sede: NORTE }),
    ]);

    const reporte = await service.consolidadoPagos({});

    expect(reporte.filas).toEqual([
      { fechaLocal: '2026-10-08', sedeId: 1, sedeNombre: 'Sede Centro', tipo: 'MEMBRESIA', monto: 30000 },
      { fechaLocal: '2026-10-08', sedeId: 1, sedeNombre: 'Sede Centro', tipo: 'RESERVA_CANCHA', monto: 7750 },
      { fechaLocal: '2026-10-08', sedeId: 2, sedeNombre: 'Sede Norte', tipo: 'RESERVA_CLASE', monto: 5000 },
    ]);
    expect(reporte.total).toBe(42750);
  });

  it('usa el día local de la sede y no el UTC (02:00Z del día 9 sigue siendo el 8)', async () => {
    const { service } = armar([
      pago({ fechaPago: new Date('2026-10-09T02:00:00.000Z') }),
      pago({ fechaPago: new Date('2026-10-09T03:00:00.000Z') }),
    ]);

    const { filas } = await service.consolidadoPagos({});

    expect(filas.map((f) => [f.fechaLocal, f.monto])).toEqual([
      ['2026-10-08', 7750],
      ['2026-10-09', 7750],
    ]);
  });

  it('separa por sede dentro del mismo día y tipo', async () => {
    const { service } = armar([pago(), pago({ sede: NORTE, monto: 100 })]);

    const { filas, total } = await service.consolidadoPagos({});

    expect(filas).toHaveLength(2);
    expect(total).toBe(7850);
  });

  it('una fila huérfana (sin sede) se descarta y se cuenta aparte sin romper', async () => {
    const { service } = armar([pago(), pago({ sede: null, monto: 999 })]);

    const reporte = await service.consolidadoPagos({});

    expect(reporte.filas).toHaveLength(1);
    expect(reporte.total).toBe(7750);
    expect(reporte.huerfanos).toBe(1);
  });

  it('suma decimales sin ruido de coma flotante', async () => {
    const { service } = armar([pago({ monto: 0.1 }), pago({ monto: 0.2 })]);

    const { total, filas } = await service.consolidadoPagos({});

    expect(filas[0].monto).toBe(0.3);
    expect(total).toBe(0.3);
  });
});
