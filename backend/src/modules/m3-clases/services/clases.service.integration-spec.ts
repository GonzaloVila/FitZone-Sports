import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { ClasesModule } from 'src/modules/m3-clases/clases.module';
import { ClasesService } from 'src/modules/m3-clases/services/clases.service';
import { crearSede } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

const HORA_MS = 60 * 60 * 1000;
// Dentro de la ventana de reserva (RF-07): la reserva solo se permite en las 48 h
// previas al inicio, así que la clase tiene que arrancar pronto pero en el futuro.
const enHoras = (h: number): string => new Date(Date.now() + h * HORA_MS).toISOString();

// Integration: bootea ClasesModule (+ M1 y M2 por sus dependencias) contra la BD real.
// Cubre el alta de clase y sus validaciones de dominio.
describe('M3 ClasesService (integration, BD real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let clases: ClasesService;
  let sedeId: number;
  const clasesCreadas: number[] = [];

  beforeAll(async () => {
    moduleRef = await crearModuloDeIntegracion(ClasesModule);
    prisma = moduleRef.get(PrismaService);
    clases = moduleRef.get(ClasesService);
    sedeId = await crearSede(prisma);
  });

  afterAll(async () => {
    await prisma.reservaClase.deleteMany({ where: { clase_id: { in: clasesCreadas } } });
    await prisma.esperaClase.deleteMany({ where: { clase_id: { in: clasesCreadas } } });
    await prisma.clase.deleteMany({ where: { id: { in: clasesCreadas } } });
    await prisma.sede.delete({ where: { id: sedeId } });
    await moduleRef.close();
  });

  async function nuevaClase(capacidad = 8, inicioHoras = 24) {
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

  it('crea una clase: sin reservas y con cupo = capacidad', async () => {
    const clase = await nuevaClase(8);

    expect(clase.capacidad).toBe(8);
    expect(clase.reservasConfirmadas).toBe(0);
    expect(clase.cupoDisponible).toBe(8);

    const leida = await clases.obtenerClase(clase.id);
    expect(leida.tipo).toBe('Yoga');
  });

  it('crearClase valida: sede inexistente 404, rango inválido 422, horario pasado 409', async () => {
    const base = { sedeId, tipo: 'Yoga', instructor: 'Ana', capacidad: 5 };

    await expect(
      clases.crearClase({ ...base, sedeId: 99999999, horarioInicio: enHoras(24), horarioFin: enHoras(25) } as never),
    ).rejects.toBeInstanceOf(ProblemException);

    await expect(
      clases.crearClase({ ...base, horarioInicio: enHoras(25), horarioFin: enHoras(24) } as never),
    ).rejects.toBeInstanceOf(ProblemException);

    await expect(
      clases.crearClase({ ...base, horarioInicio: enHoras(-1), horarioFin: enHoras(1) } as never),
    ).rejects.toBeInstanceOf(ProblemException);
  });
});
