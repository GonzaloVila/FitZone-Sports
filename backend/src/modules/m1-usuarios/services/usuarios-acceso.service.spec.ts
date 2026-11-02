import { describe, expect, it, vi } from 'vitest';
import { cuerpoDe } from '@test/helpers/pagos.fixtures';
import type { UsuarioAutenticado } from 'src/modules/auth/strategies/jwt.strategy';
import type { UsuarioIn } from 'src/modules/m1-usuarios/dtos/usuario-in.dto';
import type { UsuarioOut } from 'src/modules/m1-usuarios/dtos/usuario-out.dto';
import type { UsuarioPatch } from 'src/modules/m1-usuarios/dtos/usuario-patch.dto';
import { UsuariosAccesoService } from 'src/modules/m1-usuarios/services/usuarios-acceso.service';
import type { UsuariosService } from 'src/modules/m1-usuarios/services/usuarios.service';

const socio: UsuarioAutenticado = { userId: 7, rol: 'SOCIO', socioId: 3 };
const externo: UsuarioAutenticado = { userId: 8, rol: 'EXTERNO' };
const recepcion: UsuarioAutenticado = { userId: 9, rol: 'RECEPCION', sedeId: 1 };
const gerente: UsuarioAutenticado = { userId: 10, rol: 'GERENTE' };

function armar(rolDelObjetivo: UsuarioOut['rol'] = 'EXTERNO') {
  const usuarios = {
    crear: vi.fn().mockResolvedValue({ id: 50 }),
    obtenerPorId: vi.fn().mockResolvedValue({ id: 20, rol: rolDelObjetivo }),
    modificar: vi.fn().mockResolvedValue({ id: 20 }),
  };
  return { service: new UsuariosAccesoService(usuarios as unknown as UsuariosService), usuarios };
}

const alta = (rol: UsuarioIn['rol']) => ({ rol, dni: '30111222', nombre: 'Ana', email: 'a@x.com', contrasenia: 'clave12345' }) as UsuarioIn;
const cambio = { nombre: 'Nuevo' } as UsuarioPatch;

describe('UsuariosAccesoService', () => {
  describe('crear', () => {
    it('RECEPCION crea un EXTERNO; GERENTE crea cualquier rol', async () => {
      const { service, usuarios } = armar();

      await service.crear(recepcion, alta('EXTERNO'));
      await service.crear(gerente, alta('RECEPCION'));
      await service.crear(gerente, alta('GERENTE'));

      expect(usuarios.crear).toHaveBeenCalledTimes(3);
    });

    it('403 para RECEPCION con RECEPCION o GERENTE, sin llegar al servicio', async () => {
      const { service, usuarios } = armar();

      for (const rol of ['RECEPCION', 'GERENTE'] as const) {
        const cuerpo = await cuerpoDe(Promise.resolve().then(() => service.crear(recepcion, alta(rol))));
        expect(cuerpo.status).toBe(403);
      }
      expect(usuarios.crear).not.toHaveBeenCalled();
    });
  });

  describe('obtener', () => {
    it('SOCIO y EXTERNO ven el propio; el ajeno es 404 sin consultar', async () => {
      const { service, usuarios } = armar();

      await service.obtener(socio, 7);
      await service.obtener(externo, 8);
      expect(usuarios.obtenerPorId).toHaveBeenCalledTimes(2);

      const cuerpo = await cuerpoDe(service.obtener(socio, 99));
      expect(cuerpo.status).toBe(404);
      await cuerpoDe(service.obtener(externo, 7));
      expect(usuarios.obtenerPorId).toHaveBeenCalledTimes(2);
    });

    it('RECEPCION y GERENTE ven cualquiera', async () => {
      const { service, usuarios } = armar();

      await service.obtener(recepcion, 99);
      await service.obtener(gerente, 99);

      expect(usuarios.obtenerPorId).toHaveBeenCalledTimes(2);
    });
  });

  describe('modificar', () => {
    it('RECEPCION modifica a un SOCIO y a un EXTERNO', async () => {
      for (const rol of ['SOCIO', 'EXTERNO'] as const) {
        const { service, usuarios } = armar(rol);

        await service.modificar(recepcion, 20, cambio);

        expect(usuarios.modificar).toHaveBeenCalledWith(20, cambio);
      }
    });

    it('403 para RECEPCION sobre un RECEPCION o un GERENTE, sin modificar nada', async () => {
      for (const rol of ['RECEPCION', 'GERENTE'] as const) {
        const { service, usuarios } = armar(rol);

        const cuerpo = await cuerpoDe(service.modificar(recepcion, 20, cambio));

        expect(cuerpo.status).toBe(403);
        expect(usuarios.modificar).not.toHaveBeenCalled();
      }
    });

    it('si el usuario no existe, RECEPCION recibe el 404 de siempre', async () => {
      const { service, usuarios } = armar();
      usuarios.obtenerPorId.mockRejectedValue(new Error('404 de obtenerPorId'));

      await expect(service.modificar(recepcion, 99, cambio)).rejects.toThrow('404 de obtenerPorId');
      expect(usuarios.modificar).not.toHaveBeenCalled();
    });

    it('GERENTE modifica a cualquiera sin averiguar su rol', async () => {
      const { service, usuarios } = armar('GERENTE');

      await service.modificar(gerente, 20, cambio);

      expect(usuarios.obtenerPorId).not.toHaveBeenCalled();
      expect(usuarios.modificar).toHaveBeenCalledWith(20, cambio);
    });
  });
});
