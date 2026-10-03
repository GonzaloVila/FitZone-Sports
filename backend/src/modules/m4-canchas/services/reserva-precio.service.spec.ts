import { describe, expect, it } from 'vitest';
import { ReservaPrecioService } from './reserva-precio.service';
import type { ReservaRepository } from '../repositories/reserva.repository';

// Fijan el contrato del export que M5 consume. Lo importante acá es que el precio
// sea el CONGELADO de la fila (`precio_aplicado`), no una recalculacion: si M5
// volviera a pasar la reserva por la cadena de pricing, el socio pagaria el precio de
// hoy por un turno que reservo la semana pasada con otra tarifa.
describe('ReservaPrecioService', () => {
  function service(reserva: unknown) {
    const repo = {
      buscarPorId: async () => reserva,
    } as unknown as ReservaRepository;
    return new ReservaPrecioService(repo);
  }

  function reserva(over: Record<string, unknown> = {}) {
    return {
      id: 12,
      cancha_id: 3,
      usuario_id: 42,
      fecha_hora_inicio: new Date('2026-10-10T14:00:00.000Z'),
      fecha_hora_fin: new Date('2026-10-10T15:00:00.000Z'),
      estado: 'CONFIRMADA',
      precio_aplicado: 9500,
      ...over,
    };
  }

  it('devuelve el precio congelado con el usuario, el estado y el horario', async () => {
    const resultado = await service(reserva()).obtenerParaCobro(12);

    expect(resultado).toEqual({
      reserva_id: 12,
      usuario_id: 42,
      cancha_id: 3,
      fecha_hora_inicio: new Date('2026-10-10T14:00:00.000Z'),
      fecha_hora_fin: new Date('2026-10-10T15:00:00.000Z'),
      precio: 9500,
      estado: 'CONFIRMADA',
    });
  });

  // El comprobante en PDF (RF-14) lleva "cancha, horario y monto". Este test existe para
  // que el `toEqual` de arriba no se pueda recortar sin que salte: el horario y la
  // cancha no los necesita el cobro, los necesita el ticket, y por eso están en el
  // mismo export angosto en vez de en un segundo service que consulte la misma fila.
  it('trae la cancha y el horario que imprime el comprobante', async () => {
    const resultado = await service(reserva()).obtenerParaCobro(12);

    expect(resultado!.cancha_id).toBe(3);
    expect(resultado!.fecha_hora_inicio).toEqual(new Date('2026-10-10T14:00:00.000Z'));
    expect(resultado!.fecha_hora_fin).toEqual(new Date('2026-10-10T15:00:00.000Z'));
  });

  it('arrastra el estado CANCELADA para que M5 no cobre una reserva cancelada', async () => {
    const resultado = await service(reserva({ estado: 'CANCELADA' })).obtenerParaCobro(12);

    expect(resultado!.estado).toBe('CANCELADA');
  });

  it('devuelve null cuando la reserva no existe', async () => {
    await expect(service(null).obtenerParaCobro(999)).resolves.toBeNull();
  });
});