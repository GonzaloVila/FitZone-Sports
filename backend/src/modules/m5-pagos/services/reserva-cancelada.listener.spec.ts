import { describe, expect, it, vi } from 'vitest';
import { ReservaCanceladaListener } from 'src/modules/m5-pagos/services/reserva-cancelada.listener';

// ReservaCanceladaListener - cancelar una reserva de cancha anula su pago aprobado.
describe('ReservaCanceladaListener', () => {
  function armar(pago: { id: number; estado: string } | null) {
    const buscarPorReservaCancha = vi.fn().mockResolvedValue(pago);
    const anularPago = vi.fn().mockResolvedValue(undefined);
    const listener = new ReservaCanceladaListener(
      { buscarPorReservaCancha } as never,
      { anularPago } as never,
    );
    return { listener, buscarPorReservaCancha, anularPago };
  }

  it('anula el pago APROBADO de la reserva cancelada', async () => {
    const { listener, buscarPorReservaCancha, anularPago } = armar({ id: 12, estado: 'APROBADO' });

    await listener.onReservaCancelada({ reservaId: 40, usuarioId: 9 });

    expect(buscarPorReservaCancha).toHaveBeenCalledWith(40);
    expect(anularPago).toHaveBeenCalledWith(12);
  });

  it('si la reserva no tiene pago, no anula nada', async () => {
    const { listener, anularPago } = armar(null);

    await expect(listener.onReservaCancelada({ reservaId: 40, usuarioId: 9 })).resolves.toBeUndefined();
    expect(anularPago).not.toHaveBeenCalled();
  });

  it.each(['PENDIENTE', 'RECHAZADO', 'ANULADO'])('no anula un pago %s', async (estado) => {
    const { listener, anularPago } = armar({ id: 12, estado });

    await listener.onReservaCancelada({ reservaId: 40, usuarioId: 9 });

    expect(anularPago).not.toHaveBeenCalled();
  });

  it('propaga el error de la anulación (reembolso fallido)', async () => {
    const { listener, anularPago } = armar({ id: 12, estado: 'APROBADO' });
    anularPago.mockRejectedValueOnce(new Error('no devolvió el dinero'));

    await expect(listener.onReservaCancelada({ reservaId: 40, usuarioId: 9 })).rejects.toThrow(
      /no devolvió el dinero/,
    );
  });
});
