import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { UsuariosService } from 'src/modules/m1-usuarios/services/usuarios.service';
import { UsuariosModule } from 'src/modules/m1-usuarios/usuarios.module';
import { crearSede, dniUnico, emailUnico } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

// Integration: bootea UsuariosModule contra la BD real y llama a UsuariosService directo.
// Cubre el filtro `sedeId` del listado (sede de trabajo, EmpleadoSede), que en un unit
// con Prisma simulado no se puede comprobar: depende del JOIN real.
describe('M1 UsuariosService.listar con sedeId (integration, BD real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let usuarios: UsuariosService;
  let sedeConRecepcion: number;
  let sedeSinRecepcion: number;
  let recepcionId: number;
  let emailRecepcion: string;
  let externoId: number;
  let emailExterno: string;
  const usuariosCreados: number[] = [];
  const sedesCreadas: number[] = [];

  beforeAll(async () => {
    moduleRef = await crearModuloDeIntegracion(UsuariosModule);
    prisma = moduleRef.get(PrismaService);
    usuarios = moduleRef.get(UsuariosService);

    sedeConRecepcion = await crearSede(prisma);
    sedeSinRecepcion = await crearSede(prisma);
    sedesCreadas.push(sedeConRecepcion, sedeSinRecepcion);

    emailRecepcion = emailUnico('recep');
    const recepcion = await usuarios.crear({
      rol: 'RECEPCION',
      dni: dniUnico(),
      nombre: 'Recepcion Sede Integ',
      email: emailRecepcion,
      contrasenia: 'clave12345',
      sedeId: sedeConRecepcion,
    });
    recepcionId = recepcion.id;
    usuariosCreados.push(recepcionId);

    emailExterno = emailUnico('externo');
    const externo = await usuarios.crear({
      rol: 'EXTERNO',
      dni: dniUnico(),
      nombre: 'Externo Sin Puesto Integ',
      email: emailExterno,
      contrasenia: 'clave12345',
    });
    externoId = externo.id;
    usuariosCreados.push(externoId);
  });

  afterAll(async () => {
    await prisma.empleadoSede.deleteMany({ where: { usuario_id: { in: usuariosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
    await moduleRef.close();
  });

  const todos = { page: 1, perPage: 100 };

  it('devuelve solo el usuario con puesto en esa sede, con su sedeId', async () => {
    const res = await usuarios.listar({ sedeId: sedeConRecepcion, ...todos });

    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({ id: recepcionId, rol: 'RECEPCION', sedeId: sedeConRecepcion });
  });

  it('una sede sin recepcionista da lista vacia', async () => {
    const res = await usuarios.listar({ sedeId: sedeSinRecepcion, ...todos });

    expect(res).toEqual({ items: [], total: 0 });
  });

  it('un sedeId inexistente da lista vacia, no 404', async () => {
    const res = await usuarios.listar({ sedeId: 99999999, ...todos });

    expect(res).toEqual({ items: [], total: 0 });
  });

  it('se combina con rol, nombre y email', async () => {
    const ids = async (filtros: object) =>
      (await usuarios.listar({ sedeId: sedeConRecepcion, ...filtros, ...todos })).items.map((u) => u.id);

    expect(await ids({ rol: 'RECEPCION' })).toEqual([recepcionId]);
    expect(await ids({ rol: 'GERENTE' })).toEqual([]);
    expect(await ids({ nombre: 'recepcion sede' })).toEqual([recepcionId]);
    expect(await ids({ nombre: 'otro nombre' })).toEqual([]);
    expect(await ids({ email: emailRecepcion })).toEqual([recepcionId]);
    expect(await ids({ rol: 'RECEPCION', nombre: 'Recepcion', email: emailRecepcion })).toEqual([recepcionId]);
  });

  it('el mismo email de otra sede no coincide: la sede restringe aunque el email exista', async () => {
    const res = await usuarios.listar({ sedeId: sedeSinRecepcion, email: emailRecepcion, ...todos });

    expect(res).toEqual({ items: [], total: 0 });
  });

  it('pagina con total constante: la pagina 2 queda vacia y el total sigue en 1', async () => {
    const p1 = await usuarios.listar({ sedeId: sedeConRecepcion, page: 1, perPage: 1 });
    const p2 = await usuarios.listar({ sedeId: sedeConRecepcion, page: 2, perPage: 1 });

    expect(p1.items.map((u) => u.id)).toEqual([recepcionId]);
    expect(p2.items).toEqual([]);
    expect([p1.total, p2.total]).toEqual([1, 1]);
  });

  // No regresion: sin sedeId el listado sigue trayendo a todos, incluidos los que no
  // tienen puesto de trabajo (sedeId null).
  it('sin sedeId trae tambien a los usuarios sin puesto', async () => {
    const res = await usuarios.listar({ email: emailRecepcion, ...todos });
    expect(res.items.map((u) => u.id)).toEqual([recepcionId]);

    const sinPuesto = await usuarios.listar({ email: emailExterno, ...todos });
    expect(sinPuesto.items).toHaveLength(1);
    expect(sinPuesto.items[0]).toMatchObject({ id: externoId, sedeId: null });
    expect(res.items[0].sedeId).toBe(sedeConRecepcion);
  });
});
