import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ProblemException } from 'src/commons/filters/problem.exception';
import type { Usuario, UsuarioNuevo } from 'src/modules/m1-usuarios/entities/usuario.entity';
import type { EmpleadoSedeRepository } from 'src/modules/m1-usuarios/repositories/empleado-sede.repository';
import type { UsuarioRepository } from 'src/modules/m1-usuarios/repositories/usuario.repository';
import { UsuariosService } from 'src/modules/m1-usuarios/services/usuarios.service';

function usuario(over: Partial<Usuario> = {}): Usuario {
  return {
    id: 7,
    rol: 'SOCIO',
    dni: '30111222',
    nombre: 'Ana',
    email: 'ana@fitzone.test',
    contrasenia: 'hash',
    telefono: null,
    fotoUrl: null,
    ...over,
  };
}

// Repositorios en memoria: buscarParaAutenticarPorId solo compone buscarPorId con
// la sede del staff, no depende de la conexion.
function service(fila: Usuario | null, sedeId: number | null = 5) {
  const usuarios = { buscarPorId: async () => fila } as unknown as UsuarioRepository;
  const empleados = {
    buscarPorUsuarioId: async () => (sedeId === null ? null : { id: 1, usuarioId: 7, sedeId }),
  } as unknown as EmpleadoSedeRepository;
  return new UsuariosService(usuarios, empleados);
}

describe('UsuariosService.buscarParaAutenticarPorId', () => {
  it('RECEPCION con fila de staff devuelve su sedeId', async () => {
    const res = await service(usuario({ rol: 'RECEPCION' }), 5).buscarParaAutenticarPorId(7);
    expect(res).toMatchObject({ id: 7, rol: 'RECEPCION', sedeId: 5 });
  });

  it('RECEPCION sin fila de staff devuelve sedeId null', async () => {
    const res = await service(usuario({ rol: 'RECEPCION' }), null).buscarParaAutenticarPorId(7);
    expect(res?.sedeId).toBeNull();
  });

  it('un rol distinto de RECEPCION devuelve sedeId null aunque exista una fila de staff', async () => {
    const res = await service(usuario({ rol: 'GERENTE' }), 5).buscarParaAutenticarPorId(7);
    expect(res).toMatchObject({ rol: 'GERENTE', sedeId: null });
  });

  it('si el usuario no existe devuelve null', async () => {
    expect(await service(null).buscarParaAutenticarPorId(7)).toBeNull();
  });
});

// listar() solo compone los filtros del DTO hacia el repositorio; el where de Prisma
// se verifica en la integracion y en el e2e.
describe('UsuariosService.listar', () => {
  function serviceDeListado() {
    const llamadas: { filtros?: unknown; paginacion?: unknown } = {};
    const usuarios = {
      listar: async (filtros: unknown, paginacion: unknown) => {
        llamadas.filtros = filtros;
        llamadas.paginacion = paginacion;
        return { items: [usuario({ id: 3, rol: 'RECEPCION', sedeId: 5 })], total: 1 };
      },
    } as unknown as UsuarioRepository;
    return { service: new UsuariosService(usuarios, {} as EmpleadoSedeRepository), llamadas };
  }

  it('baja sedeId junto con rol, nombre, email y paginacion al repositorio', async () => {
    const { service, llamadas } = serviceDeListado();

    const res = await service.listar({
      sedeId: 5,
      rol: 'RECEPCION',
      nombre: 'ana',
      email: 'ana@fitzone.test',
      page: 2,
      perPage: 10,
    });

    expect(llamadas.filtros).toEqual({ rol: 'RECEPCION', sedeId: 5, nombre: 'ana', email: 'ana@fitzone.test' });
    expect(llamadas.paginacion).toEqual({ page: 2, perPage: 10 });
    expect(res).toMatchObject({ total: 1, items: [{ id: 3, sedeId: 5 }] });
  });

  it('sin sedeId no manda ese filtro y usa los defaults de paginacion', async () => {
    const { service, llamadas } = serviceDeListado();

    await service.listar({});

    expect((llamadas.filtros as { sedeId?: number }).sedeId).toBeUndefined();
    expect(llamadas.paginacion).toEqual({ page: 1, perPage: 20 });
  });
});

interface EscenarioAlta {
  duplicado?: Usuario | null;
  sedeExiste?: boolean;
  sedeOcupada?: boolean;
  errorAlCrear?: unknown;
}

// Mocks de alta: el service solo compone busquedas + hash + el INSERT (que aca
// se intercepta para poder inspeccionar que datos baja al repositorio).
function serviceDeAlta(escenario: EscenarioAlta = {}) {
  const creado = usuario({ id: 50 });
  const llamadas: { crear?: UsuarioNuevo } = {};
  const usuarios = {
    buscarPorDniOEmail: async () => escenario.duplicado ?? null,
    crear: async (datos: UsuarioNuevo) => {
      llamadas.crear = datos;
      if (escenario.errorAlCrear !== undefined) {
        throw escenario.errorAlCrear;
      }
      return creado;
    },
  } as unknown as UsuarioRepository;
  const empleados = {
    existeSede: async () => escenario.sedeExiste ?? true,
    buscarPorSedeId: async () =>
      escenario.sedeOcupada ? { id: 9, usuarioId: 77, sedeId: 5 } : null,
  } as unknown as EmpleadoSedeRepository;
  return { service: new UsuariosService(usuarios, empleados), llamadas };
}

const altaRecepcion = {
  rol: 'RECEPCION' as const,
  dni: '30111222',
  nombre: 'Recep',
  email: 'recep@fitzone.test',
  contrasenia: 'clave12345',
  sedeId: 5,
};

async function errorDe(promesa: Promise<unknown>): Promise<ProblemException> {
  try {
    await promesa;
  } catch (error) {
    return error as ProblemException;
  }
  throw new Error('Se esperaba un error y la promesa resolvio.');
}

function unicoDeSede(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`sede_id`)', {
    code: 'P2002',
    clientVersion: '6.19.3',
    meta: { target: ['sede_id'] },
  });
}

describe('UsuariosService.crear (alta con sede de trabajo)', () => {
  it('RECEPCION con sede baja el sedeId al repositorio (fila de EmpleadoSede)', async () => {
    const { service, llamadas } = serviceDeAlta();

    const creado = await service.crear(altaRecepcion);

    expect(creado.id).toBe(50);
    expect(llamadas.crear).toMatchObject({ rol: 'RECEPCION', sedeId: 5 });
  });

  it('EXTERNO y GERENTE sin sede se crean como antes y no llevan sedeId', async () => {
    for (const rol of ['EXTERNO', 'GERENTE'] as const) {
      const { service, llamadas } = serviceDeAlta();
      await service.crear({ ...altaRecepcion, rol, sedeId: undefined });
      expect(llamadas.crear).toMatchObject({ rol });
      expect(llamadas.crear?.sedeId).toBeUndefined();
    }
  });

  it('RECEPCION sin sede es 422 y no toca el repositorio', async () => {
    const { service, llamadas } = serviceDeAlta();

    const error = await errorDe(service.crear({ ...altaRecepcion, sedeId: undefined }));

    expect(error.getStatus()).toBe(422);
    expect(llamadas.crear).toBeUndefined();
  });

  it('EXTERNO y GERENTE con sede es 422 y no toca el repositorio', async () => {
    for (const rol of ['EXTERNO', 'GERENTE'] as const) {
      const { service, llamadas } = serviceDeAlta();
      const error = await errorDe(service.crear({ ...altaRecepcion, rol }));
      expect(error.getStatus()).toBe(422);
      expect(llamadas.crear).toBeUndefined();
    }
  });

  it('una sede inexistente es 404 y no crea el usuario', async () => {
    const { service, llamadas } = serviceDeAlta({ sedeExiste: false });

    const error = await errorDe(service.crear(altaRecepcion));

    expect(error.getStatus()).toBe(404);
    expect(llamadas.crear).toBeUndefined();
  });

  it('una sede que ya tiene recepcionista es 409 y no crea el usuario', async () => {
    const { service, llamadas } = serviceDeAlta({ sedeOcupada: true });

    const error = await errorDe(service.crear(altaRecepcion));

    expect(error.getStatus()).toBe(409);
    expect(llamadas.crear).toBeUndefined();
  });

  it('si otra alta toma la sede entre el chequeo y el INSERT, el P2002 se traduce a 409', async () => {
    const { service } = serviceDeAlta({ errorAlCrear: unicoDeSede() });

    const error = await errorDe(service.crear(altaRecepcion));

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({ title: 'La sede ya tiene un recepcionista' });
  });

  it('un P2002 de otra columna (email o DNI) se re-lanza sin traducir', async () => {
    const errorEmail = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`email`)', {
      code: 'P2002',
      clientVersion: '6.19.3',
      meta: { target: ['email'] },
    });
    const { service } = serviceDeAlta({ errorAlCrear: errorEmail });

    await expect(service.crear(altaRecepcion)).rejects.toBe(errorEmail);
  });
});
