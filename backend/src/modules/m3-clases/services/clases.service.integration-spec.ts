import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { ClasesModule } from 'src/modules/m3-clases/clases.module';
import { ClasesService } from 'src/modules/m3-clases/services/clases.service';
import { crearSede, crearUsuario } from '@test/helpers/base-de-datos';
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
  const sociosCreados: number[] = [];
  const usuariosCreados: number[] = [];

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
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
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

  describe('listarClases: filtro por estado', () => {
    // Una sede propia aísla el listado de las clases que otras suites dejan en la base.
    let sedeDelFiltro: number;
    let conCupos: number;
    let sinCupos: number;
    let comenzada: number;

    beforeAll(async () => {
      sedeDelFiltro = await crearSede(prisma);
      const nueva = async (capacidad: number, inicioHoras: number) => {
        const clase = await prisma.clase.create({
          data: {
            sede_id: sedeDelFiltro,
            tipo: 'Pilates',
            instructor: 'Ana',
            horario_inicio: new Date(Date.now() + inicioHoras * HORA_MS),
            horario_fin: new Date(Date.now() + (inicioHoras + 1) * HORA_MS),
            capacidad,
          },
        });
        clasesCreadas.push(clase.id);
        return clase.id;
      };
      conCupos = await nueva(5, 24);
      sinCupos = await nueva(1, 25);
      comenzada = await nueva(5, -1);

      // Una reserva confirmada agota el cupo de la clase de capacidad 1 y deja con cupos a la de 5. La cancelada no cuenta.
      const usuarioId = await crearUsuario(prisma, 'SOCIO');
      usuariosCreados.push(usuarioId);
      const socio = await prisma.socio.create({
        data: { usuario_id: usuarioId, sede_origen_id: sedeDelFiltro, fecha_alta: new Date() },
      });
      sociosCreados.push(socio.id);
      await prisma.reservaClase.create({ data: { clase_id: sinCupos, socio_id: socio.id, estado: 'CONFIRMADA' } });
      await prisma.reservaClase.create({ data: { clase_id: conCupos, socio_id: socio.id, estado: 'CANCELADA' } });
      await prisma.reservaClase.create({ data: { clase_id: comenzada, socio_id: socio.id, estado: 'CONFIRMADA' } });
    });

    afterAll(async () => {
      await prisma.reservaClase.deleteMany({ where: { clase_id: { in: [conCupos, sinCupos, comenzada] } } });
      await prisma.clase.deleteMany({ where: { id: { in: [conCupos, sinCupos, comenzada] } } });
      await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
      await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
      await prisma.sede.delete({ where: { id: sedeDelFiltro } });
    });

    const idsPara = async (filtros: Parameters<ClasesService['listarClases']>[0]) =>
      (await clases.listarClases({ sedeId: sedeDelFiltro, ...filtros })).items.map((c) => c.id).sort();

    it('sin estado devuelve las clases en cualquier estado', async () => {
      expect(await idsPara({})).toEqual([conCupos, sinCupos, comenzada].sort());
    });

    it('CON_CUPOS: solo las futuras con cupo disponible', async () => {
      expect(await idsPara({ estado: 'CON_CUPOS' })).toEqual([conCupos]);
    });

    it('SIN_CUPOS: solo las futuras con el cupo agotado', async () => {
      expect(await idsPara({ estado: 'SIN_CUPOS' })).toEqual([sinCupos]);
    });

    it('COMENZADA: las que ya empezaron, aunque tengan cupos', async () => {
      expect(await idsPara({ estado: 'COMENZADA' })).toEqual([comenzada]);
    });

    it('el total y la paginación son los del conjunto filtrado y se combina con los demás filtros', async () => {
      const filtradas = await clases.listarClases({ sedeId: sedeDelFiltro, estado: 'CON_CUPOS', page: 1, perPage: 1 });
      expect(filtradas.total).toBe(1);
      expect(filtradas.items).toHaveLength(1);

      const otroTipo = await clases.listarClases({ sedeId: sedeDelFiltro, tipo: 'Yoga', estado: 'CON_CUPOS' });
      expect(otroTipo.total).toBe(0);
    });
  });
});
