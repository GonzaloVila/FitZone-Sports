import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { ListarUsuariosQueryDto } from 'src/modules/m1-usuarios/dtos/listar-usuarios-query.dto';
import { MembresiaPatch } from 'src/modules/m1-usuarios/dtos/membresia-patch.dto';
import { SocioIn } from 'src/modules/m1-usuarios/dtos/socio-in.dto';
import { SocioPatch } from 'src/modules/m1-usuarios/dtos/socio-patch.dto';
import { UsuarioIn } from 'src/modules/m1-usuarios/dtos/usuario-in.dto';
import { erroresDe } from '@test/helpers/validar-dto';

// Validación de los DTOs de entrada de M1 (el 422 por input que antes vivía en e2e).
describe('M1 - DTOs de usuarios, socios y membresías', () => {
  describe('UsuarioIn', () => {
    const valido = {
      rol: 'EXTERNO',
      dni: '35123456',
      nombre: 'Ana Gómez',
      email: 'ana.gomez@fitzone.com.ar',
      contrasenia: 'clave12345',
    };

    it('acepta un usuario bien formado, con o sin opcionales', async () => {
      expect(await erroresDe(UsuarioIn, valido)).toEqual([]);
      expect(await erroresDe(UsuarioIn, { ...valido, telefono: '+54 351 555-1234' })).toEqual([]);
    });

    // SOCIO no se da de alta por acá: solo por POST /socios (que crea la membresía).
    it('rechaza el rol SOCIO', async () => {
      expect(await erroresDe(UsuarioIn, { ...valido, rol: 'SOCIO' })).not.toEqual([]);
    });

    it('rechaza un dni no numérico o demasiado corto', async () => {
      expect(await erroresDe(UsuarioIn, { ...valido, dni: '3512345a' })).not.toEqual([]);
      expect(await erroresDe(UsuarioIn, { ...valido, dni: '123' })).not.toEqual([]);
    });

    it('rechaza email inválido y contraseña corta', async () => {
      expect(await erroresDe(UsuarioIn, { ...valido, email: 'no-es-un-mail' })).not.toEqual([]);
      expect(await erroresDe(UsuarioIn, { ...valido, contrasenia: 'corta' })).not.toEqual([]);
    });

    it('rechaza campos desconocidos', async () => {
      expect(await erroresDe(UsuarioIn, { ...valido, socioId: 1 })).not.toEqual([]);
    });

    // `sedeId` es opcional en el DTO porque la obligatoriedad depende del rol y
    // la aplica UsuariosService. El DTO solo cuida la forma: entero positivo.
    it('acepta sedeId entero positivo y lo deja pasar cuando falta', async () => {
      expect(await erroresDe(UsuarioIn, { ...valido, sedeId: 5 })).toEqual([]);
      expect(await erroresDe(UsuarioIn, valido)).toEqual([]);
    });

    it('rechaza sedeId no entero, no positivo o null', async () => {
      expect(await erroresDe(UsuarioIn, { ...valido, sedeId: 0 })).not.toEqual([]);
      expect(await erroresDe(UsuarioIn, { ...valido, sedeId: -3 })).not.toEqual([]);
      expect(await erroresDe(UsuarioIn, { ...valido, sedeId: 2.5 })).not.toEqual([]);
      expect(await erroresDe(UsuarioIn, { ...valido, sedeId: '5' })).not.toEqual([]);
      expect(await erroresDe(UsuarioIn, { ...valido, sedeId: null })).not.toEqual([]);
    });
  });

  describe('ListarUsuariosQueryDto', () => {
    it('acepta consulta vacía y sedeId combinado con los demás filtros', async () => {
      expect(await erroresDe(ListarUsuariosQueryDto, {})).toEqual([]);
      expect(
        await erroresDe(ListarUsuariosQueryDto, {
          sedeId: '3',
          rol: 'RECEPCION',
          nombre: 'ana',
          email: 'ana@fitzone.com.ar',
          page: '2',
          perPage: '50',
        }),
      ).toEqual([]);
    });

    it('convierte sedeId a número y lo deja indefinido si no viene', () => {
      expect(plainToInstance(ListarUsuariosQueryDto, { sedeId: '3' }).sedeId).toBe(3);
      expect(plainToInstance(ListarUsuariosQueryDto, {}).sedeId).toBeUndefined();
    });

    it('rechaza sedeId no entero, no positivo o no numérico', async () => {
      expect(await erroresDe(ListarUsuariosQueryDto, { sedeId: '0' })).not.toEqual([]);
      expect(await erroresDe(ListarUsuariosQueryDto, { sedeId: '-2' })).not.toEqual([]);
      expect(await erroresDe(ListarUsuariosQueryDto, { sedeId: '1.5' })).not.toEqual([]);
      expect(await erroresDe(ListarUsuariosQueryDto, { sedeId: 'abc' })).not.toEqual([]);
    });

    it('sigue rechazando la paginación fuera de rango y los parámetros fuera de la lista blanca', async () => {
      expect(await erroresDe(ListarUsuariosQueryDto, { page: '0' })).not.toEqual([]);
      expect(await erroresDe(ListarUsuariosQueryDto, { perPage: '101' })).not.toEqual([]);
      expect(await erroresDe(ListarUsuariosQueryDto, { sedeOrigenId: '3' })).not.toEqual([]);
    });
  });

  describe('SocioIn', () => {
    it('acepta usuarioId, sedeOrigenId y un plan del enum', async () => {
      expect(await erroresDe(SocioIn, { usuarioId: 1, sedeOrigenId: 3, plan: 'MENSUAL' })).toEqual([]);
    });

    // No existe un socio sin membresía: el plan es obligatorio.
    it('rechaza la falta de plan y un plan inventado', async () => {
      expect(await erroresDe(SocioIn, { usuarioId: 1, sedeOrigenId: 3 })).not.toEqual([]);
      expect(await erroresDe(SocioIn, { usuarioId: 1, sedeOrigenId: 3, plan: 'INVENTADO' })).not.toEqual([]);
    });

    it('rechaza ids no positivos', async () => {
      expect(await erroresDe(SocioIn, { usuarioId: 0, sedeOrigenId: 3, plan: 'MENSUAL' })).not.toEqual([]);
    });
  });

  describe('SocioPatch', () => {
    it('acepta body vacío y una sede válida; rechaza sede 0', async () => {
      expect(await erroresDe(SocioPatch, {})).toEqual([]);
      expect(await erroresDe(SocioPatch, { sedeOrigenId: 3 })).toEqual([]);
      expect(await erroresDe(SocioPatch, { sedeOrigenId: 0 })).not.toEqual([]);
    });
  });

  describe('MembresiaPatch', () => {
    it('acepta body vacío y cada campo por separado', async () => {
      expect(await erroresDe(MembresiaPatch, {})).toEqual([]);
      expect(await erroresDe(MembresiaPatch, { estado: 'SUSPENDIDA' })).toEqual([]);
      expect(await erroresDe(MembresiaPatch, { plan: 'TRIMESTRAL' })).toEqual([]);
      expect(await erroresDe(MembresiaPatch, { renuevaAutomatica: false })).toEqual([]);
    });

    // VENCIDA solo lo produce el cron: aceptarlo por API dejaría una fila inconsistente.
    it('rechaza el estado VENCIDA y un plan inválido', async () => {
      expect(await erroresDe(MembresiaPatch, { estado: 'VENCIDA' })).not.toEqual([]);
      expect(await erroresDe(MembresiaPatch, { plan: 'SEMANAL' })).not.toEqual([]);
    });

    it('rechaza renuevaAutomatica no booleano', async () => {
      expect(await erroresDe(MembresiaPatch, { renuevaAutomatica: 'si' })).not.toEqual([]);
    });
  });
});
