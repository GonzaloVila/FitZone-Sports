import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { PRECIOS_PLAN } from 'src/modules/m1-usuarios/entities/membresia.entity';
import { MembresiasService } from 'src/modules/m1-usuarios/services/membresias.service';
import { SociosService } from 'src/modules/m1-usuarios/services/socios.service';
import { UsuariosModule } from 'src/modules/m1-usuarios/usuarios.module';
import { crearSede, crearUsuario } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

// Integration: alta (vía M1), suspender/reactivar, cambio de plan y errores, contra la
// BD real. El cobro del cambio de plan sobre una membresía no vigente (evento a M5) se
// cubre en el e2e (cobro-interno), porque acá M5 no está cargado.
describe('M1 MembresiasService (integration, BD real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let membresias: MembresiasService;
  let socios: SociosService;
  let sedeId: number;
  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];

  beforeAll(async () => {
    moduleRef = await crearModuloDeIntegracion(UsuariosModule);
    prisma = moduleRef.get(PrismaService);
    membresias = moduleRef.get(MembresiasService);
    socios = moduleRef.get(SociosService);
    sedeId = await crearSede(prisma);
  });

  afterAll(async () => {
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.delete({ where: { id: sedeId } });
    await moduleRef.close();
  });

  async function alta(plan = 'MENSUAL') {
    const usuarioId = await crearUsuario(prisma, 'EXTERNO');
    usuariosCreados.push(usuarioId);
    const socio = await socios.crear({ usuarioId, sedeOrigenId: sedeId, plan } as never);
    sociosCreados.push(socio.id);
    return socio.id;
  }

  it('el alta deja una membresía ACTIVA del plan pedido', async () => {
    const socioId = await alta('MENSUAL');

    const membresia = await membresias.obtenerPorSocioId(socioId);
    expect(membresia.estado).toBe('ACTIVA');
    expect(membresia.plan).toBe('MENSUAL');
    expect(new Date(membresia.fechaFin).getTime()).toBeGreaterThan(Date.now());
  });

  it('suspende y reactiva sin mover la fechaFin', async () => {
    const socioId = await alta();

    const suspendida = await membresias.modificar(socioId, { estado: 'SUSPENDIDA' } as never);
    expect(suspendida.estado).toBe('SUSPENDIDA');
    const fechaFin = suspendida.fechaFin;

    const reactivada = await membresias.modificar(socioId, { estado: 'ACTIVA' } as never);
    expect(reactivada.estado).toBe('ACTIVA');
    expect(new Date(reactivada.fechaFin).getTime()).toBe(new Date(fechaFin).getTime());
  });

  it('el cambio de plan mueve el precio y las DOS fechas juntas', async () => {
    const socioId = await alta('MENSUAL');
    const antes = await prisma.membresia.findUniqueOrThrow({ where: { socio_id: socioId } });
    expect(antes.precio.toNumber()).toBe(PRECIOS_PLAN.MENSUAL);

    const modificada = await membresias.modificar(socioId, { plan: 'TRIMESTRAL' } as never);
    expect(modificada.plan).toBe('TRIMESTRAL');

    const despues = await prisma.membresia.findUniqueOrThrow({ where: { socio_id: socioId } });
    expect(despues.precio.toNumber()).toBe(PRECIOS_PLAN.TRIMESTRAL);

    const ahora = Date.now();
    expect(Math.abs(new Date(despues.fecha_inicio).getTime() - ahora)).toBeLessThanOrEqual(60_000);
    const esperado = new Date(despues.fecha_inicio);
    esperado.setMonth(esperado.getMonth() + 3);
    expect(new Date(despues.fecha_fin).toISOString()).toBe(esperado.toISOString());
  });

  it('422 (sin campos para modificar) con body vacío, sin tocar la fila', async () => {
    const socioId = await alta('TRIMESTRAL');
    const antes = await prisma.membresia.findUniqueOrThrow({ where: { socio_id: socioId } });

    await expect(membresias.modificar(socioId, {} as never)).rejects.toBeInstanceOf(ProblemException);

    const despues = await prisma.membresia.findUniqueOrThrow({ where: { socio_id: socioId } });
    expect(despues.plan).toBe(antes.plan);
    expect(despues.estado).toBe(antes.estado);
    expect(despues.fecha_fin.getTime()).toBe(antes.fecha_fin.getTime());
  });

  it('404 si el socio no existe', async () => {
    await expect(membresias.obtenerPorSocioId(99999999)).rejects.toBeInstanceOf(ProblemException);
    await expect(membresias.modificar(99999999, { estado: 'ACTIVA' } as never)).rejects.toBeInstanceOf(ProblemException);
  });
});
