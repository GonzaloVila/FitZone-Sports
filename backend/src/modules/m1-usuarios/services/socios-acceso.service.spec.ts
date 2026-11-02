import { describe, expect, it, vi } from 'vitest';
import { cuerpoDe } from '@test/helpers/pagos.fixtures';
import type { UsuarioAutenticado } from 'src/modules/auth/strategies/jwt.strategy';
import type { MembresiasService } from 'src/modules/m1-usuarios/services/membresias.service';
import { SociosAccesoService } from 'src/modules/m1-usuarios/services/socios-acceso.service';
import type { SociosService } from 'src/modules/m1-usuarios/services/socios.service';

const socio: UsuarioAutenticado = { userId: 7, rol: 'SOCIO', socioId: 3 };
const externo: UsuarioAutenticado = { userId: 8, rol: 'EXTERNO' };
const recepcion: UsuarioAutenticado = { userId: 9, rol: 'RECEPCION', sedeId: 1 };
const gerente: UsuarioAutenticado = { userId: 10, rol: 'GERENTE' };

function armar() {
  const socios = { obtenerPorId: vi.fn().mockResolvedValue({ id: 3 }) };
  const membresias = { obtenerPorSocioId: vi.fn().mockResolvedValue({ id: 5 }) };
  const service = new SociosAccesoService(socios as unknown as SociosService, membresias as unknown as MembresiasService);
  return { service, socios, membresias };
}

describe('SociosAccesoService', () => {
  describe('obtener', () => {
    it('el SOCIO ve el suyo; otro socio es 404 con el texto de "no existe", sin consultar', async () => {
      const { service, socios } = armar();

      await expect(service.obtener(socio, 3)).resolves.toMatchObject({ id: 3 });
      const cuerpo = await cuerpoDe(service.obtener(socio, 4));

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toBe('No existe el recurso solicitado para el id indicado.');
      expect(socios.obtenerPorId).toHaveBeenCalledTimes(1);
    });

    it('el EXTERNO recibe 404 siempre', async () => {
      const { service, socios } = armar();

      const cuerpo = await cuerpoDe(service.obtener(externo, 3));

      expect(cuerpo.status).toBe(404);
      expect(socios.obtenerPorId).not.toHaveBeenCalled();
    });

    it('RECEPCION y GERENTE ven cualquiera', async () => {
      const { service, socios } = armar();

      await service.obtener(recepcion, 4);
      await service.obtener(gerente, 4);

      expect(socios.obtenerPorId).toHaveBeenCalledTimes(2);
    });
  });

  describe('obtenerMembresia', () => {
    it('el SOCIO ve la suya; la de otro es 404 con el texto de "no existe el socio"', async () => {
      const { service, membresias } = armar();

      await expect(service.obtenerMembresia(socio, 3)).resolves.toMatchObject({ id: 5 });
      const cuerpo = await cuerpoDe(service.obtenerMembresia(socio, 4));

      expect(cuerpo.status).toBe(404);
      expect(cuerpo.detail).toBe('No existe el socio indicado.');
      expect(membresias.obtenerPorSocioId).toHaveBeenCalledTimes(1);
    });

    it('el EXTERNO recibe 404, y RECEPCION y GERENTE ven cualquiera', async () => {
      const { service, membresias } = armar();

      await cuerpoDe(service.obtenerMembresia(externo, 3));
      await service.obtenerMembresia(recepcion, 4);
      await service.obtenerMembresia(gerente, 4);

      expect(membresias.obtenerPorSocioId).toHaveBeenCalledTimes(2);
    });
  });
});
