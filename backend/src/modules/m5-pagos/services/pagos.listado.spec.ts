import { describe, expect, it, vi } from 'vitest';
import { armar, cuerpoDe, pagoPersistido } from '@test/helpers/pagos.fixtures';

// PagosService - listado y consulta (defaults, rango de fechas y paginación).
describe('PagosService - listado y consulta', () => {
  describe('listarPagos', () => {
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

    it('con estado TODOS el repositorio recibe estado undefined (sin filtro de estado)', async () => {
      const { service, pagos } = armar();

      await service.listarPagos({ estado: 'TODOS', page: 1, perPage: 20 });

      const [filtros] = pagos.listar.mock.calls[0] as [{ estado?: string }, unknown];
      expect(filtros.estado).toBeUndefined();
      expect(filtros).not.toHaveProperty('estado', 'TODOS');
    });

    it('traduce desde/hasta a un rango semiabierto que incluye el último día', async () => {
      const { service, pagos } = armar();

      await service.listarPagos({ desde: '2026-03-01', hasta: '2026-03-31', page: 1, perPage: 20 });

      const [filtros] = pagos.listar.mock.calls[0] as [{ desde?: Date; hasta?: Date }, unknown];
      // Buenos Aires es UTC-3: el 1/3 arranca a las 03:00Z y el 1/4 (exclusive) también.
      expect(filtros.desde?.toISOString()).toBe('2026-03-01T03:00:00.000Z');
      expect(filtros.hasta?.toISOString()).toBe('2026-04-01T03:00:00.000Z');
    });

    it('deja el rango abierto si solo viene uno de los dos días', async () => {
      const { service, pagos } = armar();

      await service.listarPagos({ desde: '2026-03-01', page: 1, perPage: 20 });

      const [filtros] = pagos.listar.mock.calls[0] as [{ desde?: Date; hasta?: Date }, unknown];
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
        listar: vi.fn().mockResolvedValue({
          items: [
            pagoPersistido({ estado: 'APROBADO', comprobantePdfUrl: '/storage/comprobantes/12.pdf' }),
          ],
          total: 1,
        }),
      });

      const salida = await service.listarPagos({ page: 1, perPage: 20 });

      expect(salida.items).toHaveLength(1);
      expect(salida.total).toBe(1);
      expect(salida.items[0].id).toBe(12);
      expect(salida.items[0]).not.toHaveProperty('token');
      expect(salida.items[0]).not.toHaveProperty('idempotenciaKey');
    });
  });

  describe('obtenerPago', () => {
    it('devuelve el pago sin token ni clave', async () => {
      const { service } = armar({ buscarPorId: vi.fn().mockResolvedValue(pagoPersistido()) });

      const salida = await service.obtenerPago(12);

      expect(salida.id).toBe(12);
      expect(salida).not.toHaveProperty('token');
      expect(salida).not.toHaveProperty('idempotenciaKey');
    });

    it('404 si el pago no existe', async () => {
      const { service } = armar({ buscarPorId: vi.fn().mockResolvedValue(null) });

      const cuerpo = await cuerpoDe(service.obtenerPago(999));

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toContain('999');
    });
  });
});
