import { describe, expect, it, vi } from 'vitest';
import { cuerpoDe } from '@test/helpers/pagos.fixtures';
import type { UsuarioAutenticado } from 'src/modules/auth/strategies/jwt.strategy';
import type { IngresoIn } from 'src/modules/m2-gimnasio/dtos/ingreso-in.dto';
import type { IngresoOut } from 'src/modules/m2-gimnasio/dtos/ingreso-out.dto';
import { IngresosAccesoService } from 'src/modules/m2-gimnasio/services/ingresos-acceso.service';
import type { IngresosService } from 'src/modules/m2-gimnasio/services/ingresos.service';

const recepcion: UsuarioAutenticado = { userId: 9, rol: 'RECEPCION', sedeId: 1 };
const gerente: UsuarioAutenticado = { userId: 10, rol: 'GERENTE' };

function armar() {
  const ingresos = {
    registrarIngreso: vi.fn().mockResolvedValue({ id: 15, sedeId: 1 } as IngresoOut),
    obtenerIngreso: vi.fn().mockResolvedValue({ id: 15, sedeId: 1 } as IngresoOut),
    obtenerAforo: vi.fn().mockResolvedValue({ aforoActual: 1, aforoMaximo: 10, restante: 9 }),
  };
  return { service: new IngresosAccesoService(ingresos as unknown as IngresosService), ingresos };
}

const ingresoEn = (sedeId: number) => ({ sedeId, socioId: 3, codigoTotp: '123456' }) as IngresoIn;

describe('IngresosAccesoService', () => {
  describe('registrar', () => {
    it('RECEPCION registra en su sede y GERENTE en cualquiera', async () => {
      const { service, ingresos } = armar();

      await service.registrar(recepcion, ingresoEn(1));
      await service.registrar(gerente, ingresoEn(2));

      expect(ingresos.registrarIngreso).toHaveBeenCalledTimes(2);
    });

    it('403 para RECEPCION en otra sede, sin llegar al servicio', async () => {
      const { service, ingresos } = armar();

      const cuerpo = await cuerpoDe(Promise.resolve().then(() => service.registrar(recepcion, ingresoEn(2))));

      expect(cuerpo.status).toBe(403);
      expect(ingresos.registrarIngreso).not.toHaveBeenCalled();
    });
  });

  describe('obtener', () => {
    it('RECEPCION ve el ingreso de su sede y GERENTE cualquiera', async () => {
      const { service, ingresos } = armar();

      await expect(service.obtener(recepcion, 15)).resolves.toMatchObject({ id: 15 });
      ingresos.obtenerIngreso.mockResolvedValue({ id: 16, sedeId: 2 });
      await expect(service.obtener(gerente, 16)).resolves.toMatchObject({ id: 16 });
    });

    it('403 para RECEPCION si el ingreso es de otra sede; el 404 sigue siendo 404', async () => {
      const { service, ingresos } = armar();
      ingresos.obtenerIngreso.mockResolvedValue({ id: 16, sedeId: 2 });

      const ajeno = await cuerpoDe(service.obtener(recepcion, 16));
      expect(ajeno.status).toBe(403);
      expect(ajeno.detail).toBe('El ingreso 16 no pertenece a la sede del recepcionista.');

      ingresos.obtenerIngreso.mockRejectedValue(new Error('no existe'));
      await expect(service.obtener(recepcion, 99)).rejects.toThrow('no existe');
    });
  });

  describe('aforo', () => {
    it('RECEPCION consulta su sede y GERENTE cualquiera', async () => {
      const { service, ingresos } = armar();

      await service.aforo(recepcion, 1);
      await service.aforo(gerente, 2);

      expect(ingresos.obtenerAforo.mock.calls).toEqual([[1], [2]]);
    });

    it('403 para RECEPCION en otra sede, sin consultar el aforo', async () => {
      const { service, ingresos } = armar();

      const cuerpo = await cuerpoDe(Promise.resolve().then(() => service.aforo(recepcion, 2)));

      expect(cuerpo.status).toBe(403);
      expect(ingresos.obtenerAforo).not.toHaveBeenCalled();
    });
  });
});
