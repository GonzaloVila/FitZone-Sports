import { describe, expect, it, vi } from 'vitest';
import { cuerpoDe } from '@test/helpers/pagos.fixtures';
import type { UsuarioAutenticado } from 'src/modules/auth/strategies/jwt.strategy';
import type { ClaseIn } from 'src/modules/m3-clases/dtos/clase-in.dto';
import type { EsperaIn } from 'src/modules/m3-clases/dtos/espera-in.dto';
import type { ListarEsperasClaseQueryDto } from 'src/modules/m3-clases/dtos/listar-esperas-clase-query.dto';
import type { ListarReservasClaseQueryDto } from 'src/modules/m3-clases/dtos/listar-reservas-clase-query.dto';
import type { ReservaClaseIn } from 'src/modules/m3-clases/dtos/reserva-clase-in.dto';
import { ClasesAccesoService } from 'src/modules/m3-clases/services/clases-acceso.service';
import type { ClasesService } from 'src/modules/m3-clases/services/clases.service';
import type { EsperasClasesService } from 'src/modules/m3-clases/services/esperas-clases.service';
import type { ReservasClasesService } from 'src/modules/m3-clases/services/reservas-clases.service';

const socio: UsuarioAutenticado = { userId: 7, rol: 'SOCIO', socioId: 3 };
const socioSinSocioId: UsuarioAutenticado = { userId: 6, rol: 'SOCIO' };
const recepcion: UsuarioAutenticado = { userId: 9, rol: 'RECEPCION', sedeId: 1 };
const gerente: UsuarioAutenticado = { userId: 10, rol: 'GERENTE' };

// La reserva y la espera del mock son del socio 3.
function armar() {
  const clases = { crearClase: vi.fn().mockResolvedValue({ id: 1 }) };
  const reservas = {
    crearReservaClase: vi.fn().mockResolvedValue({ id: 10, socioId: 3 }),
    listarReservasClase: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    obtenerReservaClase: vi.fn().mockResolvedValue({ id: 10, socioId: 3 }),
    cancelarReservaClase: vi.fn().mockResolvedValue(undefined),
  };
  const esperas = {
    anotarseEnEspera: vi.fn().mockResolvedValue({ id: 4, socioId: 3 }),
    listarEsperasClase: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    obtenerEspera: vi.fn().mockResolvedValue({ id: 4, socioId: 3 }),
    salirDeEspera: vi.fn().mockResolvedValue(undefined),
    confirmarEspera: vi.fn().mockResolvedValue({ id: 11 }),
  };
  const service = new ClasesAccesoService(
    clases as unknown as ClasesService,
    reservas as unknown as ReservasClasesService,
    esperas as unknown as EsperasClasesService,
  );
  return { service, clases, reservas, esperas };
}

const claseEn = (sedeId: number) => ({ sedeId }) as ClaseIn;
const reservaDe = (socioId: number) => ({ claseId: 1, socioId }) as ReservaClaseIn;
const esperaDe = (socioId: number) => ({ socioId }) as EsperaIn;

describe('ClasesAccesoService', () => {
  describe('crearClase', () => {
    it('RECEPCION crea en su sede y GERENTE en cualquiera', async () => {
      const { service, clases } = armar();

      await service.crearClase(recepcion, claseEn(1));
      await service.crearClase(gerente, claseEn(2));

      expect(clases.crearClase).toHaveBeenCalledTimes(2);
    });

    it('403 para RECEPCION en otra sede, sin crear', async () => {
      const { service, clases } = armar();

      const cuerpo = await cuerpoDe(service.crearClase(recepcion, claseEn(2)));

      expect(cuerpo.status).toBe(403);
      expect(clases.crearClase).not.toHaveBeenCalled();
    });
  });

  describe('reservas de clase', () => {
    it('el SOCIO reserva a su nombre; con otro socioId es 404 y no se reserva', async () => {
      const { service, reservas } = armar();

      await service.crearReserva(socio, reservaDe(3));
      expect(reservas.crearReservaClase).toHaveBeenCalledTimes(1);

      const cuerpo = await cuerpoDe(service.crearReserva(socio, reservaDe(4)));
      expect(cuerpo.status).toBe(404);
      expect(reservas.crearReservaClase).toHaveBeenCalledTimes(1);
    });

    it('RECEPCION y GERENTE reservan por cualquier socio', async () => {
      const { service, reservas } = armar();

      await service.crearReserva(recepcion, reservaDe(4));
      await service.crearReserva(gerente, reservaDe(5));

      expect(reservas.crearReservaClase).toHaveBeenCalledTimes(2);
    });

    it('el listado del SOCIO fuerza su socioId; el del personal no cambia el filtro', async () => {
      const { service, reservas } = armar();

      await service.listarReservas(socio, { socioId: 99, claseId: 1 } as ListarReservasClaseQueryDto);
      await service.listarReservas(recepcion, { socioId: 99 } as ListarReservasClaseQueryDto);
      await service.listarReservas(gerente, {} as ListarReservasClaseQueryDto);

      expect(reservas.listarReservasClase.mock.calls[0]![0]).toMatchObject({ socioId: 3, claseId: 1 });
      expect(reservas.listarReservasClase.mock.calls[1]![0]).toMatchObject({ socioId: 99 });
      expect(reservas.listarReservasClase.mock.calls[2]![0].socioId).toBeUndefined();
    });

    it('403 en el listado y en el alta si el token del SOCIO no trae socioId', async () => {
      const { service } = armar();

      expect((await cuerpoDe(service.listarReservas(socioSinSocioId, {} as ListarReservasClaseQueryDto))).status).toBe(403);
      expect((await cuerpoDe(service.crearReserva(socioSinSocioId, reservaDe(3)))).status).toBe(403);
    });

    it('el SOCIO ve y cancela la suya; la de otro es 404 y no se cancela', async () => {
      const { service, reservas } = armar();

      await expect(service.obtenerReserva(socio, 10)).resolves.toMatchObject({ id: 10 });
      await service.cancelarReserva(socio, 10);
      expect(reservas.cancelarReservaClase).toHaveBeenCalledTimes(1);

      reservas.obtenerReservaClase.mockResolvedValue({ id: 12, socioId: 4 });
      expect((await cuerpoDe(service.obtenerReserva(socio, 12))).status).toBe(404);
      expect((await cuerpoDe(service.cancelarReserva(socio, 12))).status).toBe(404);
      expect(reservas.cancelarReservaClase).toHaveBeenCalledTimes(1);
    });

    it('RECEPCION y GERENTE ven y cancelan cualquiera, sin leer antes al cancelar', async () => {
      const { service, reservas } = armar();
      reservas.obtenerReservaClase.mockResolvedValue({ id: 12, socioId: 4 });

      await expect(service.obtenerReserva(recepcion, 12)).resolves.toMatchObject({ id: 12 });
      await service.cancelarReserva(recepcion, 12);
      await service.cancelarReserva(gerente, 12);

      expect(reservas.obtenerReservaClase).toHaveBeenCalledTimes(1);
      expect(reservas.cancelarReservaClase).toHaveBeenCalledTimes(2);
    });
  });

  describe('esperas', () => {
    it('el SOCIO se anota a su nombre; con otro socioId es 404 y no se anota', async () => {
      const { service, esperas } = armar();

      await service.anotarse(socio, 1, esperaDe(3));
      expect((await cuerpoDe(service.anotarse(socio, 1, esperaDe(4)))).status).toBe(404);

      expect(esperas.anotarseEnEspera).toHaveBeenCalledTimes(1);
    });

    it('RECEPCION y GERENTE anotan a cualquiera', async () => {
      const { service, esperas } = armar();

      await service.anotarse(recepcion, 1, esperaDe(4));
      await service.anotarse(gerente, 1, esperaDe(5));

      expect(esperas.anotarseEnEspera).toHaveBeenCalledTimes(2);
    });

    it('el listado del SOCIO fuerza su socioId; el del personal no cambia el filtro', async () => {
      const { service, esperas } = armar();

      await service.listarEsperas(socio, { socioId: 99 } as ListarEsperasClaseQueryDto);
      await service.listarEsperas(gerente, { socioId: 99 } as ListarEsperasClaseQueryDto);

      expect(esperas.listarEsperasClase.mock.calls[0]![0]).toMatchObject({ socioId: 3 });
      expect(esperas.listarEsperasClase.mock.calls[1]![0]).toMatchObject({ socioId: 99 });
    });

    it('el SOCIO ve, sale y confirma solo su espera; la de otro es 404 y no se toca', async () => {
      const { service, esperas } = armar();

      await service.obtenerEspera(socio, 4);
      await service.salirDeEspera(socio, 4);
      await service.confirmarEspera(socio, 4);
      expect(esperas.salirDeEspera).toHaveBeenCalledTimes(1);
      expect(esperas.confirmarEspera).toHaveBeenCalledTimes(1);

      esperas.obtenerEspera.mockResolvedValue({ id: 5, socioId: 4 });
      expect((await cuerpoDe(service.obtenerEspera(socio, 5))).status).toBe(404);
      expect((await cuerpoDe(service.salirDeEspera(socio, 5))).status).toBe(404);
      expect((await cuerpoDe(service.confirmarEspera(socio, 5))).status).toBe(404);
      expect(esperas.salirDeEspera).toHaveBeenCalledTimes(1);
      expect(esperas.confirmarEspera).toHaveBeenCalledTimes(1);
    });

    it('RECEPCION y GERENTE ven, sacan y confirman cualquiera, sin leer antes', async () => {
      const { service, esperas } = armar();

      await service.salirDeEspera(recepcion, 5);
      await service.confirmarEspera(gerente, 5);

      expect(esperas.obtenerEspera).not.toHaveBeenCalled();
      expect(esperas.salirDeEspera).toHaveBeenCalledTimes(1);
      expect(esperas.confirmarEspera).toHaveBeenCalledTimes(1);
    });
  });
});
