import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { SociosService } from 'src/modules/m1-usuarios/services/socios.service';
import { ClasesModule } from 'src/modules/m3-clases/clases.module';
import { ClasesService } from 'src/modules/m3-clases/services/clases.service';
import { EsperasClasesService } from 'src/modules/m3-clases/services/esperas-clases.service';
import { ReservasClasesService } from 'src/modules/m3-clases/services/reservas-clases.service';
import { crearSede, crearUsuario } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

const HORA_MS = 60 * 60 * 1000;
const enHoras = (h: number): string => new Date(Date.now() + h * HORA_MS).toISOString();

// Integration: lista de espera (RF-08) — cupo libre vs clase llena y espera duplicada.
describe('M3 EsperasClasesService (integration, BD real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let clases: ClasesService;
  let reservas: ReservasClasesService;
  let esperas: EsperasClasesService;
  let socios: SociosService;
  let sedeId: number;
  let socioA: number;
  let socioB: number;
  const clasesCreadas: number[] = [];
  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];

  beforeAll(async () => {
    moduleRef = await crearModuloDeIntegracion(ClasesModule);
    prisma = moduleRef.get(PrismaService);
    clases = moduleRef.get(ClasesService);
    reservas = moduleRef.get(ReservasClasesService);
    esperas = moduleRef.get(EsperasClasesService);
    socios = moduleRef.get(SociosService);
    sedeId = await crearSede(prisma);

    for (const slot of ['A', 'B']) {
      const usuarioId = await crearUsuario(prisma, 'EXTERNO');
      usuariosCreados.push(usuarioId);
      const socio = await socios.crear({ usuarioId, sedeOrigenId: sedeId, plan: 'MENSUAL' } as never);
      sociosCreados.push(socio.id);
      if (slot === 'A') socioA = socio.id;
      else socioB = socio.id;
    }
  });

  afterAll(async () => {
    await prisma.reservaClase.deleteMany({ where: { clase_id: { in: clasesCreadas } } });
    await prisma.esperaClase.deleteMany({ where: { clase_id: { in: clasesCreadas } } });
    await prisma.clase.deleteMany({ where: { id: { in: clasesCreadas } } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.delete({ where: { id: sedeId } });
    await moduleRef.close();
  });

  async function nuevaClase(capacidad = 10, inicioHoras = 24) {
    const clase = await clases.crearClase({
      sedeId,
      tipo: 'Yoga',
      instructor: 'Ana',
      horarioInicio: enHoras(inicioHoras),
      horarioFin: enHoras(inicioHoras + 1),
      capacidad,
    } as never);
    clasesCreadas.push(clase.id);
    return clase;
  }

  it('con cupo libre → 409; con la clase llena entra a la espera; repetir → 409', async () => {
    const conCupo = await nuevaClase(5);
    await expect(esperas.anotarseEnEspera(conCupo.id, { socioId: socioA } as never)).rejects.toBeInstanceOf(
      ProblemException,
    );

    const llena = await nuevaClase(1);
    await reservas.crearReservaClase(llena.id, { socioId: socioA } as never);

    const espera = await esperas.anotarseEnEspera(llena.id, { socioId: socioB } as never);
    expect(espera.estado).toBe('EN_ESPERA');

    const deClase = await esperas.listarEsperaDeClase(llena.id, { page: 1, perPage: 100 } as never);
    expect(deClase.items.map((e) => e.id)).toContain(espera.id);
    expect(deClase.total).toBeGreaterThanOrEqual(1);

    await expect(esperas.anotarseEnEspera(llena.id, { socioId: socioB } as never)).rejects.toBeInstanceOf(
      ProblemException,
    );
  });
});
