import { describe, expect, it, vi } from 'vitest';
import { cuerpoDe, dtoDe } from '@test/helpers/pagos.fixtures';
import type { UsuarioAutenticado } from 'src/modules/auth/strategies/jwt.strategy';
import type { PagoOut } from 'src/modules/m5-pagos/dtos/pago-out.dto';
import { PagosAccesoService } from 'src/modules/m5-pagos/services/pagos-acceso.service';
import type { PagosService } from 'src/modules/m5-pagos/services/pagos.service';

const socio: UsuarioAutenticado = { userId: 7, rol: 'SOCIO', socioId: 3 };
const externo: UsuarioAutenticado = { userId: 8, rol: 'EXTERNO' };
const recepcion: UsuarioAutenticado = { userId: 9, rol: 'RECEPCION', sedeId: 1 };
const gerente: UsuarioAutenticado = { userId: 10, rol: 'GERENTE' };

const pagoDe = (usuarioId: number) => ({ id: 12, usuarioId, estado: 'APROBADO' }) as PagoOut;

function armar(over: { duenioReserva?: number | null; duenioMembresia?: number | null; duenioClase?: number | null } = {}) {
  const pagos = {
    procesarPago: vi.fn().mockResolvedValue(pagoDe(7)),
    listarPagos: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    obtenerPago: vi.fn().mockResolvedValue(pagoDe(7)),
    obtenerComprobante: vi.fn().mockResolvedValue({ buffer: Buffer.from('pdf'), nombre: 'c.pdf' }),
  };
  const como = (usuarioId: number | null | undefined) =>
    vi.fn().mockResolvedValue(usuarioId === null ? null : { usuarioId: usuarioId ?? 7 });
  const membresias = { obtenerParaCobro: como(over.duenioMembresia) };
  const reservas = { obtenerParaCobro: como(over.duenioReserva) };
  const reservaClases = { obtenerParaCobro: como(over.duenioClase) };
  const service = new PagosAccesoService(
    pagos as unknown as PagosService,
    membresias as never,
    reservas as never,
    reservaClases as never,
  );
  return { service, pagos, membresias, reservas, reservaClases };
}

const cobroReserva = () => dtoDe({ concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: 4 } as never });
const cobroMembresia = () => dtoDe({ concepto: { tipo: 'MEMBRESIA', membresiaId: 5 } as never });
const cobroClase = () => dtoDe({ concepto: { tipo: 'RESERVA_CLASE', reservaClaseId: 6 } as never });

describe('PagosAccesoService', () => {
  describe('listar', () => {
    it('SOCIO y EXTERNO fuerzan su usuarioId aunque pidan el de otro', async () => {
      const { service, pagos } = armar();

      await service.listar(socio, { usuarioId: 99, page: 1, perPage: 20 });
      await service.listar(externo, { page: 1, perPage: 20 });

      expect(pagos.listarPagos.mock.calls[0]![0]).toMatchObject({ usuarioId: 7 });
      expect(pagos.listarPagos.mock.calls[1]![0]).toMatchObject({ usuarioId: 8 });
    });

    it('RECEPCION y GERENTE no cambian el filtro', async () => {
      const { service, pagos } = armar();

      await service.listar(recepcion, { usuarioId: 99, estado: 'TODOS', page: 1, perPage: 20 });
      await service.listar(gerente, { page: 2, perPage: 5 });

      expect(pagos.listarPagos.mock.calls[0]![0]).toMatchObject({ usuarioId: 99, estado: 'TODOS' });
      expect(pagos.listarPagos.mock.calls[1]![0].usuarioId).toBeUndefined();
    });
  });

  describe('obtener y comprobante', () => {
    it('404 con el texto de "no existe" al ver o descargar el pago de otro (SOCIO y EXTERNO)', async () => {
      const { service, pagos } = armar();
      pagos.obtenerPago.mockResolvedValue(pagoDe(55));

      for (const actor of [socio, externo]) {
        const visto = await cuerpoDe(service.obtener(actor, 12));
        const descargado = await cuerpoDe(service.comprobante(actor, 12));
        expect(visto).toMatchObject({ status: 404, detail: 'No existe el pago 12.' });
        expect(descargado).toMatchObject({ status: 404, detail: 'No existe el pago 12.' });
      }
      expect(pagos.obtenerComprobante).not.toHaveBeenCalled();
    });

    it('el pago propio se ve y se descarga', async () => {
      const { service, pagos } = armar();

      expect((await service.obtener(socio, 12)).id).toBe(12);
      expect((await service.comprobante(socio, 12)).nombre).toBe('c.pdf');
      expect(pagos.obtenerComprobante).toHaveBeenCalledWith(12);
    });

    it('RECEPCION y GERENTE acceden a cualquier pago', async () => {
      const { service, pagos } = armar();
      pagos.obtenerPago.mockResolvedValue(pagoDe(55));

      expect((await service.obtener(recepcion, 12)).usuarioId).toBe(55);
      expect((await service.comprobante(gerente, 12)).nombre).toBe('c.pdf');
    });
  });

  describe('procesar', () => {
    it('404 como "no existe" al cobrar un concepto ajeno (reserva, membresia o clase), sin cobrar', async () => {
      const { service, pagos } = armar({ duenioReserva: 55, duenioMembresia: 55, duenioClase: 55 });

      const reserva = await cuerpoDe(service.procesar(socio, cobroReserva(), 'k1'));
      const membresia = await cuerpoDe(service.procesar(externo, cobroMembresia(), 'k2'));
      const clase = await cuerpoDe(service.procesar(socio, cobroClase(), 'k3'));

      expect(reserva).toMatchObject({ status: 404, detail: 'No existe la reserva 4.' });
      expect(membresia).toMatchObject({ status: 404, detail: 'No existe la membresía 5.' });
      expect(clase).toMatchObject({ status: 404, detail: 'No existe la reserva de clase 6.' });
      expect(pagos.procesarPago).not.toHaveBeenCalled();
    });

    it('cobra el concepto propio', async () => {
      const { service, pagos } = armar({ duenioReserva: 7 });
      const dto = cobroReserva();

      await service.procesar(socio, dto, 'k1');

      expect(pagos.procesarPago).toHaveBeenCalledWith(dto, 'k1');
    });

    it('si el concepto no existe delega: PagosService responde su propio 404', async () => {
      const { service, pagos } = armar({ duenioReserva: null });

      await service.procesar(socio, cobroReserva(), 'k1');

      expect(pagos.procesarPago).toHaveBeenCalledTimes(1);
    });

    it('RECEPCION y GERENTE cobran cualquier concepto sin consultar al dueño', async () => {
      const { service, pagos, reservas, membresias, reservaClases } = armar({ duenioReserva: 55 });

      await service.procesar(recepcion, cobroReserva(), 'k1');
      await service.procesar(gerente, cobroMembresia(), 'k2');

      expect(pagos.procesarPago).toHaveBeenCalledTimes(2);
      expect(reservas.obtenerParaCobro).not.toHaveBeenCalled();
      expect(membresias.obtenerParaCobro).not.toHaveBeenCalled();
      expect(reservaClases.obtenerParaCobro).not.toHaveBeenCalled();
    });
  });
});
