import { describe, expect, it, vi } from 'vitest';
import { armar, cuerpoDe, pagoPersistido } from '@test/helpers/pagos.fixtures';

// PagosService - anulación: devolución a la pasarela, idempotencia y errores.
describe('PagosService - anulación', () => {
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

    it('un ANULADO responde sin escribir y sin reembolsar otra vez', async () => {
      const { service, pagos, pasarela } = armar({
        buscarPorId: vi.fn().mockResolvedValue(pagoPersistido({ estado: 'ANULADO' })),
      });

      await expect(service.anularPago(12)).resolves.toBeUndefined();

      expect(pagos.anular).not.toHaveBeenCalled();
      expect(pasarela.reembolsar).not.toHaveBeenCalled();
    });

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

    it('sube el error si el pago se anuló pero la pasarela no devolvió', async () => {
      const { service } = armar({
        buscarPorId: vi.fn().mockResolvedValue(pagoPersistido({ estado: 'APROBADO' })),
        reembolsar: vi.fn().mockResolvedValue({ ok: false, motivo: 'la pasarela rechazó la devolución' }),
      });

      await expect(service.anularPago(12)).rejects.toThrow(/no devolvió el dinero/);
    });
  });
});
