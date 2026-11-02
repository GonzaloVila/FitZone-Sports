import { describe, expect, it, vi } from 'vitest';
import { cuerpoDe } from '@test/helpers/pagos.fixtures';
import type { UsuarioAutenticado } from 'src/modules/auth/strategies/jwt.strategy';
import type { ListarReservasCanchasQueryDto } from 'src/modules/m4-canchas/dtos/listar-reservas-canchas-query.dto';
import type { ReservaCanchaIn } from 'src/modules/m4-canchas/dtos/reserva-cancha-in.dto';
import { ReservasCanchasAccesoService } from 'src/modules/m4-canchas/services/reservas-canchas-acceso.service';
import type { ReservasCanchasService } from 'src/modules/m4-canchas/services/reservas-canchas.service';

const socio: UsuarioAutenticado = { userId: 7, rol: 'SOCIO', socioId: 3 };
const externo: UsuarioAutenticado = { userId: 8, rol: 'EXTERNO' };
const recepcion: UsuarioAutenticado = { userId: 9, rol: 'RECEPCION', sedeId: 1 };
const gerente: UsuarioAutenticado = { userId: 10, rol: 'GERENTE' };

// La reserva del mock es del usuario 7 (el SOCIO).
function armar() {
  const reservas = {
    listar: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    crear: vi.fn().mockResolvedValue({ id: 4, usuarioId: 7 }),
    obtener: vi.fn().mockResolvedValue({ id: 4, usuarioId: 7 }),
    cancelar: vi.fn().mockResolvedValue(undefined),
  };
  return { service: new ReservasCanchasAccesoService(reservas as unknown as ReservasCanchasService), reservas };
}

const reservaDe = (usuarioId: number) => ({ canchaId: 1, usuarioId }) as ReservaCanchaIn;

describe('ReservasCanchasAccesoService', () => {
  describe('listar', () => {
    it('SOCIO y EXTERNO fuerzan su userId aunque pidan el de otro', async () => {
      const { service, reservas } = armar();

      await service.listar(socio, { usuarioId: 99 } as ListarReservasCanchasQueryDto);
      await service.listar(externo, {} as ListarReservasCanchasQueryDto);

      expect(reservas.listar.mock.calls[0]![0]).toMatchObject({ usuarioId: 7, page: 1, perPage: 20 });
      expect(reservas.listar.mock.calls[1]![0]).toMatchObject({ usuarioId: 8 });
    });

    it('RECEPCION y GERENTE no cambian los filtros: la grilla lista las reservas ajenas por cancha y día', async () => {
      const { service, reservas } = armar();

      await service.listar(recepcion, { canchaId: 2, fecha: '2026-11-12' } as ListarReservasCanchasQueryDto);
      await service.listar(gerente, { usuarioId: 99, perPage: 5 } as ListarReservasCanchasQueryDto);

      expect(reservas.listar.mock.calls[0]![0]).toMatchObject({ canchaId: 2, fecha: '2026-11-12' });
      expect(reservas.listar.mock.calls[0]![0].usuarioId).toBeUndefined();
      expect(reservas.listar.mock.calls[1]![0]).toMatchObject({ usuarioId: 99, perPage: 5 });
    });
  });

  describe('crear', () => {
    it('SOCIO y EXTERNO reservan a su nombre; a nombre de otro es 404 y no se reserva', async () => {
      const { service, reservas } = armar();

      await service.crear(socio, reservaDe(7));
      await service.crear(externo, reservaDe(8));
      expect(reservas.crear).toHaveBeenCalledTimes(2);

      const cuerpo = await cuerpoDe(service.crear(socio, reservaDe(8)));
      expect(cuerpo.status).toBe(404);
      expect(reservas.crear).toHaveBeenCalledTimes(2);
    });

    it('RECEPCION y GERENTE reservan por cualquiera', async () => {
      const { service, reservas } = armar();

      await service.crear(recepcion, reservaDe(7));
      await service.crear(gerente, reservaDe(8));

      expect(reservas.crear).toHaveBeenCalledTimes(2);
    });
  });

  describe('obtener', () => {
    it('SOCIO ve la suya; EXTERNO, que no es la dueña, recibe 404', async () => {
      const { service } = armar();

      await expect(service.obtener(socio, 4)).resolves.toMatchObject({ id: 4 });
      const cuerpo = await cuerpoDe(service.obtener(externo, 4));

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toBe('No existe el recurso solicitado para el id indicado.');
    });

    it('RECEPCION y GERENTE ven cualquiera', async () => {
      const { service } = armar();

      await expect(service.obtener(recepcion, 4)).resolves.toMatchObject({ id: 4 });
      await expect(service.obtener(gerente, 4)).resolves.toMatchObject({ id: 4 });
    });
  });

  describe('cancelar', () => {
    it('SOCIO cancela la suya; la de otro es 404 y no se cancela', async () => {
      const { service, reservas } = armar();

      await service.cancelar(socio, 4);
      expect(reservas.cancelar).toHaveBeenCalledTimes(1);

      const cuerpo = await cuerpoDe(service.cancelar(externo, 4));
      expect(cuerpo.status).toBe(404);
      expect(reservas.cancelar).toHaveBeenCalledTimes(1);
    });

    it('RECEPCION y GERENTE cancelan cualquiera, sin leer la reserva antes', async () => {
      const { service, reservas } = armar();

      await service.cancelar(recepcion, 4);
      await service.cancelar(gerente, 4);

      expect(reservas.obtener).not.toHaveBeenCalled();
      expect(reservas.cancelar).toHaveBeenCalledTimes(2);
    });
  });
});
