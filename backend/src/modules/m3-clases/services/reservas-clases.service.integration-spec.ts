import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { SociosService } from 'src/modules/m1-usuarios/services/socios.service';
import { ClasesModule } from 'src/modules/m3-clases/clases.module';
import { ClasesService } from 'src/modules/m3-clases/services/clases.service';
import { ReservasClasesService } from 'src/modules/m3-clases/services/reservas-clases.service';
import { crearSede, crearUsuario } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

const HORA_MS = 60 * 60 * 1000;
const enHoras = (h: number): string => new Date(Date.now() + h * HORA_MS).toISOString();

// Integration: reserva de clase con cupo/lock, cancelación y el State derivado (CUMPLIDA).
describe('M3 ReservasClasesService (integration, BD real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let clases: ClasesService;
  let reservas: ReservasClasesService;
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

  it('reserva una clase: queda CONFIRMADA y baja el cupo', async () => {
    const clase = await nuevaClase(10);

    const reserva = await reservas.crearReservaClase(clase.id, { socioId: socioA } as never);
    expect(reserva.estado).toBe('CONFIRMADA');

    const deClase = await reservas.listarReservasDeClase(clase.id, { page: 1, perPage: 100 } as never);
    expect(deClase.items.map((r) => r.id)).toContain(reserva.id);
    expect(deClase.total).toBe(1);

    const releida = await clases.obtenerClase(clase.id);
    expect(releida.reservasConfirmadas).toBe(1);
    expect(releida.cupoDisponible).toBe(9);
  });

  it('reserva duplicada del mismo socio → 409', async () => {
    const clase = await nuevaClase(10);
    await reservas.crearReservaClase(clase.id, { socioId: socioA } as never);

    await expect(reservas.crearReservaClase(clase.id, { socioId: socioA } as never)).rejects.toBeInstanceOf(
      ProblemException,
    );
  });

  it('cupo agotado → 409 (no sobrevende)', async () => {
    const clase = await nuevaClase(1);
    await reservas.crearReservaClase(clase.id, { socioId: socioA } as never);

    await expect(reservas.crearReservaClase(clase.id, { socioId: socioB } as never)).rejects.toBeInstanceOf(
      ProblemException,
    );
  });

  it('cancelar una reserva la deja CANCELADA y libera el cupo', async () => {
    const clase = await nuevaClase(1);
    const reserva = await reservas.crearReservaClase(clase.id, { socioId: socioA } as never);

    await reservas.cancelarReservaClase(reserva.id);

    const fila = await prisma.reservaClase.findUnique({ where: { id: reserva.id } });
    expect(fila?.estado).toBe('CANCELADA');

    const deB = await reservas.crearReservaClase(clase.id, { socioId: socioB } as never);
    expect(deB.estado).toBe('CONFIRMADA');
  });

  it('estado derivado: la reserva de una clase ya empezada sale CUMPLIDA y no se cancela', async () => {
    const pasada = await prisma.clase.create({
      data: {
        sede_id: sedeId,
        tipo: 'Pilates',
        instructor: 'Beto',
        horario_inicio: new Date(Date.now() - 2 * HORA_MS),
        horario_fin: new Date(Date.now() - HORA_MS),
        capacidad: 5,
      },
    });
    clasesCreadas.push(pasada.id);
    const reserva = await prisma.reservaClase.create({
      data: { clase_id: pasada.id, socio_id: socioA, estado: 'CONFIRMADA' },
    });

    const out = await reservas.obtenerReservaClase(reserva.id);
    expect(out.estado).toBe('CUMPLIDA');

    await expect(reservas.cancelarReservaClase(reserva.id)).rejects.toBeInstanceOf(ProblemException);
  });
});
