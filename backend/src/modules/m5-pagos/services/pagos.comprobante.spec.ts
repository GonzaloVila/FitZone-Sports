import { describe, expect, it, vi } from 'vitest';
import type { Pago } from 'src/modules/m5-pagos/entities/pago.entity';
import { armar, cuerpoDe, dtoDe, pagoPersistido } from '@test/helpers/pagos.fixtures';

// PagosService - comprobante: cuándo se genera en el cobro (RF-14) y cómo se sirve.
describe('PagosService - comprobante', () => {
  describe('comprobante en el cobro', () => {
    it('genera el PDF y lo registra si el pago quedó APROBADO', async () => {
      const { service, comprobantes, pagos } = armar();

      const salida = await service.procesarPago(dtoDe(), 'clave-1');

      expect(comprobantes.generar).toHaveBeenCalledWith(
        expect.objectContaining({ id: 12, monto: 8000, estado: 'APROBADO' }),
        { tipo: 'RESERVA_CANCHA', reservaCanchaId: 7 },
      );
      expect(pagos.registrarComprobante).toHaveBeenCalledWith(12, '/storage/comprobantes/12.pdf');
      expect(salida.comprobantePdfUrl).toBe('/storage/comprobantes/12.pdf');
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
        cobrar: vi.fn().mockResolvedValue({ estado: 'PENDIENTE', pasarelaToken: 'tok_pendiente_1' }),
      });

      const salida = await service.procesarPago(dtoDe(), 'clave-1');

      expect(comprobantes.generar).not.toHaveBeenCalled();
      expect(salida.comprobantePdfUrl).toBeNull();
    });
  });

  describe('obtenerComprobante', () => {
    const conComprobante = (over: Partial<Pago> = {}) =>
      pagoPersistido({ estado: 'APROBADO', comprobantePdfUrl: '/storage/comprobantes/12.pdf', ...over });

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
        buscarPorId: vi.fn().mockResolvedValue(conComprobante({ comprobantePdfUrl: null })),
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
});
