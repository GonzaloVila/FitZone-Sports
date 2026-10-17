import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { SociosService } from 'src/modules/m1-usuarios/services/socios.service';
import { UsuariosModule } from 'src/modules/m1-usuarios/usuarios.module';
import { crearSede, crearUsuario } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

// Integration: bootea UsuariosModule contra la BD real y llama a SociosService directo.
// Cubre alta/baja/re-alta, listado con filtros y errores, que en e2e sobraban.
describe('M1 SociosService (integration, BD real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let socios: SociosService;
  let sedeId: number;
  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const sedesCreadas: number[] = [];

  beforeAll(async () => {
    moduleRef = await crearModuloDeIntegracion(UsuariosModule);
    prisma = moduleRef.get(PrismaService);
    socios = moduleRef.get(SociosService);
    sedeId = await crearSede(prisma);
    sedesCreadas.push(sedeId);
  });

  afterAll(async () => {
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
    await moduleRef.close();
  });

  async function crearExterno(): Promise<number> {
    const id = await crearUsuario(prisma, 'EXTERNO');
    usuariosCreados.push(id);
    return id;
  }

  async function alta(usuarioId: number, plan = 'MENSUAL') {
    const socio = await socios.crear({ usuarioId, sedeOrigenId: sedeId, plan } as never);
    sociosCreados.push(socio.id);
    return socio;
  }

  it('crea socio + membresía en una transacción y deja el usuario en SOCIO', async () => {
    const usuarioId = await crearExterno();

    const socio = await alta(usuarioId);
    expect(socio.usuarioId).toBe(usuarioId);

    const membresia = await prisma.membresia.findFirst({ where: { socio_id: socio.id } });
    expect(membresia?.estado).toBe('ACTIVA');
    expect(membresia?.plan).toBe('MENSUAL');

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    expect(usuario?.rol).toBe('SOCIO');
  });

  it('404 si el usuario no existe', async () => {
    await expect(
      socios.crear({ usuarioId: 99999999, sedeOrigenId: sedeId, plan: 'MENSUAL' } as never),
    ).rejects.toBeInstanceOf(ProblemException);
  });

  it('409 si el usuario ya es socio', async () => {
    const usuarioId = await crearExterno();
    await alta(usuarioId);

    await expect(
      socios.crear({ usuarioId, sedeOrigenId: sedeId, plan: 'MENSUAL' } as never),
    ).rejects.toBeInstanceOf(ProblemException);
  });

  it('lista con filtros sobre la relación (sede, plan, estado, nombre)', async () => {
    const usuarioCarlos = await crearExterno();
    const carlos = await alta(usuarioCarlos, 'MENSUAL');
    const usuarioZoe = await crearExterno();
    const zoe = await alta(usuarioZoe, 'ANUAL');

    const porSede = await socios.listar({ sedeOrigenId: sedeId, page: 1, perPage: 100 } as never);
    expect(porSede.items.map((s) => s.id)).toContain(carlos.id);

    const porPlan = await socios.listar({ plan: 'MENSUAL', page: 1, perPage: 100 } as never);
    expect(porPlan.items.map((s) => s.id)).toContain(carlos.id);
    expect(porPlan.items.map((s) => s.id)).not.toContain(zoe.id);

    const combinado = await socios.listar({ estadoMembresia: 'ACTIVA', plan: 'ANUAL', page: 1, perPage: 100 } as never);
    expect(combinado.items.map((s) => s.id)).toContain(zoe.id);
  });

  it('obtenerPorId devuelve nombre/email y 404 si no existe', async () => {
    const socio = await alta(await crearExterno());

    const out = await socios.obtenerPorId(socio.id);
    expect(out.nombre).toBeTruthy();
    expect(out.email).toBeTruthy();

    await expect(socios.obtenerPorId(99999999)).rejects.toBeInstanceOf(ProblemException);
  });

  it('modificar cambia la sede y persiste; 422 con body vacío', async () => {
    const socio = await alta(await crearExterno());

    const otraSede = await crearSede(prisma);
    sedesCreadas.push(otraSede);
    const modificado = await socios.modificar(socio.id, { sedeOrigenId: otraSede } as never);
    expect(modificado.sedeOrigenId).toBe(otraSede);

    await expect(socios.modificar(socio.id, {} as never)).rejects.toBeInstanceOf(ProblemException);
  });

  it('dejarDeSerSocio: baja lógica (membresía SUSPENDIDA + rol EXTERNO) y la re-alta reactiva la MISMA fila', async () => {
    const usuarioId = await crearExterno();
    const socio = await alta(usuarioId);

    await socios.dejarDeSerSocio(socio.id);

    const fila = await prisma.socio.findUnique({ where: { id: socio.id } });
    expect(fila?.activo).toBe(false);
    expect(fila?.fecha_baja).not.toBeNull();
    const membresia = await prisma.membresia.findFirst({ where: { socio_id: socio.id } });
    expect(membresia?.estado).toBe('SUSPENDIDA');
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    expect(usuario?.rol).toBe('EXTERNO');

    // 404 en el detalle (baja lógica: no aparece).
    await expect(socios.obtenerPorId(socio.id)).rejects.toBeInstanceOf(ProblemException);

    // Re-alta: reactiva la MISMA fila con el plan nuevo.
    const reAlta = await socios.crear({ usuarioId, sedeOrigenId: sedeId, plan: 'TRIMESTRAL' } as never);
    expect(reAlta.id).toBe(socio.id);
    const reactivada = await prisma.socio.findUnique({ where: { id: socio.id } });
    expect(reactivada?.activo).toBe(true);
    const membresiaNueva = await prisma.membresia.findFirst({ where: { socio_id: socio.id } });
    expect(membresiaNueva?.estado).toBe('ACTIVA');
    expect(membresiaNueva?.plan).toBe('TRIMESTRAL');
  });
});
