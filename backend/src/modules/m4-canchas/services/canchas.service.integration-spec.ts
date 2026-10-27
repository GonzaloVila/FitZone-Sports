import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { PrismaService } from 'src/commons/database/prisma.service';
import { CanchasModule } from 'src/modules/m4-canchas/canchas.module';
import { CanchasService } from 'src/modules/m4-canchas/services/canchas.service';
import { crearSede } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

// Integration: bootea solo CanchasModule (no el AppModule) contra la BD real y llama
// al SERVICE directo (sin HTTP). Cubre el CRUD de canchas, que en e2e sobraba.
describe('M4 CanchasService (integration, BD real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let canchas: CanchasService;
  let sedeId: number;
  const canchasCreadas: number[] = [];
  // Sedes extra que crean los tests del listado general (GET /canchas).
  const sedesExtra: number[] = [];

  beforeAll(async () => {
    moduleRef = await crearModuloDeIntegracion(CanchasModule);
    prisma = moduleRef.get(PrismaService);
    canchas = moduleRef.get(CanchasService);
    sedeId = await crearSede(prisma);
  });

  afterAll(async () => {
    await prisma.cancha.deleteMany({ where: { id: { in: canchasCreadas } } });
    await prisma.sede.deleteMany({ where: { id: { in: [sedeId, ...sedesExtra] } } });
    await moduleRef.close();
  });

  async function crear(dto: { tipo: string; costoPorHora: number; estado?: string }, enSede = sedeId) {
    const cancha = await canchas.crear(enSede, dto as never);
    canchasCreadas.push(cancha.id);
    return cancha;
  }

  async function nuevaSede(): Promise<number> {
    const id = await crearSede(prisma);
    sedesExtra.push(id);
    return id;
  }

  it('crea una cancha en OPERATIVA por defecto', async () => {
    const cancha = await crear({ tipo: 'PADDLE', costoPorHora: 7000 });

    expect(cancha.tipo).toBe('PADDLE');
    expect(cancha.costoPorHora).toBe(7000);
    expect(cancha.estado).toBe('OPERATIVA');
  });

  it('devuelve costo_por_hora como numero (no string de Decimal)', async () => {
    const cancha = await crear({ tipo: 'FUTBOL5', costoPorHora: 7250.5 });

    expect(typeof cancha.costoPorHora).toBe('number');
    expect(cancha.costoPorHora).toBeCloseTo(7250.5, 2);
  });

  it('lista por sede e incluye las canchas en mantenimiento; filtra por estado', async () => {
    await crear({ tipo: 'PADDLE', costoPorHora: 5000 });
    await crear({ tipo: 'PADDLE', costoPorHora: 5000, estado: 'EN_MANTENIMIENTO' });

    const todas = await canchas.listar(sedeId, { page: 1, perPage: 100 });
    expect(todas.items.length).toBeGreaterThanOrEqual(2);
    expect(todas.items.filter((c) => c.estado === 'EN_MANTENIMIENTO').length).toBeGreaterThan(0);
    expect(todas.total).toBeGreaterThanOrEqual(2);

    const operativas = await canchas.listar(sedeId, { estado: 'OPERATIVA', page: 1, perPage: 100 });
    expect(operativas.items.every((c) => c.estado === 'OPERATIVA')).toBe(true);
  });

  it('404 si la sede no existe', async () => {
    await expect(canchas.crear(99999999, { tipo: 'PADDLE', costoPorHora: 5000 } as never)).rejects.toBeInstanceOf(
      ProblemException,
    );
  });

  it('obtiene por id con todos los campos y 404 si no existe', async () => {
    const cancha = await crear({ tipo: 'FUTBOL5', costoPorHora: 6400 });

    const out = await canchas.obtener(cancha.id);
    expect(out).toMatchObject({ id: cancha.id, sedeId, tipo: 'FUTBOL5', costoPorHora: 6400, estado: 'OPERATIVA' });

    await expect(canchas.obtener(99999999)).rejects.toBeInstanceOf(ProblemException);
  });

  it('actualiza solo costo (deja estado) y solo estado (deja costo), y persiste', async () => {
    const cancha = await crear({ tipo: 'PADDLE', costoPorHora: 5000 });

    const soloCosto = await canchas.actualizar(cancha.id, { costoPorHora: 5500 } as never);
    expect(soloCosto.costoPorHora).toBe(5500);
    expect(soloCosto.estado).toBe('OPERATIVA');

    const soloEstado = await canchas.actualizar(cancha.id, { estado: 'EN_MANTENIMIENTO' } as never);
    expect(soloEstado.estado).toBe('EN_MANTENIMIENTO');
    expect(soloEstado.costoPorHora).toBe(5500);

    const persistida = await canchas.obtener(cancha.id);
    expect(persistida.costoPorHora).toBe(5500);
    expect(persistida.estado).toBe('EN_MANTENIMIENTO');
  });

  it('422 (canchaSinCamposParaModificar) con body vacio, sin tocar la fila', async () => {
    const cancha = await crear({ tipo: 'PADDLE', costoPorHora: 5000 });

    await expect(canchas.actualizar(cancha.id, {} as never)).rejects.toBeInstanceOf(ProblemException);

    const persistida = await canchas.obtener(cancha.id);
    expect(persistida.costoPorHora).toBe(5000);
    expect(persistida.estado).toBe('OPERATIVA');
  });

  // GET /canchas: el listado de todas las sedes. Cada test arma sus propias sedes y
  // filtra por ellas, asi no depende de lo que haya en la base.
  describe('buscar (listado de todas las sedes)', () => {
    const todas = { page: 1, perPage: 100 };

    // Sede con 4 canchas: PADDLE operativa, PADDLE en mantenimiento, FUTBOL5 operativa
    // y FUTBOL5 en mantenimiento.
    async function sedeConCuatro() {
      const id = await nuevaSede();
      const paddleOp = await crear({ tipo: 'PADDLE', costoPorHora: 5000 }, id);
      const paddleMant = await crear({ tipo: 'PADDLE', costoPorHora: 5100, estado: 'EN_MANTENIMIENTO' }, id);
      const futbolOp = await crear({ tipo: 'FUTBOL5', costoPorHora: 6000 }, id);
      const futbolMant = await crear({ tipo: 'FUTBOL5', costoPorHora: 6100, estado: 'EN_MANTENIMIENTO' }, id);
      return { id, paddleOp, paddleMant, futbolOp, futbolMant };
    }

    it('filtra por sedeId y trae todas sus canchas, incluidas las en mantenimiento', async () => {
      const a = await sedeConCuatro();
      const b = await sedeConCuatro();

      const res = await canchas.buscar({ sedeId: a.id, ...todas });

      expect(res.total).toBe(4);
      expect(res.items.map((c) => c.id)).toEqual([a.paddleOp.id, a.paddleMant.id, a.futbolOp.id, a.futbolMant.id]);
      expect(res.items.every((c) => c.sedeId === a.id)).toBe(true);
      expect(res.items.map((c) => c.id)).not.toContain(b.paddleOp.id);
    });

    it('filtra por tipo y por estado, solos y combinados', async () => {
      const { id, paddleOp, paddleMant, futbolOp, futbolMant } = await sedeConCuatro();

      const idsDe = async (filtros: { tipo?: 'PADDLE' | 'FUTBOL5'; estado?: 'OPERATIVA' | 'EN_MANTENIMIENTO' }) =>
        (await canchas.buscar({ sedeId: id, ...filtros, ...todas })).items.map((c) => c.id);

      expect(await idsDe({ tipo: 'PADDLE' })).toEqual([paddleOp.id, paddleMant.id]);
      expect(await idsDe({ tipo: 'FUTBOL5' })).toEqual([futbolOp.id, futbolMant.id]);
      expect(await idsDe({ estado: 'OPERATIVA' })).toEqual([paddleOp.id, futbolOp.id]);
      expect(await idsDe({ estado: 'EN_MANTENIMIENTO' })).toEqual([paddleMant.id, futbolMant.id]);
      expect(await idsDe({ tipo: 'FUTBOL5', estado: 'EN_MANTENIMIENTO' })).toEqual([futbolMant.id]);
      expect(await idsDe({})).toHaveLength(4);
    });

    it('sin sedeId abarca varias sedes y sus filtros por tipo/estado se aplican a todas', async () => {
      await sedeConCuatro();
      const b = await sedeConCuatro();

      // El listado puede no caber en una pagina si la base tiene muchas canchas: el
      // total se compara con el conteo real, no con lo que entre en 100.
      const sinFiltros = await canchas.buscar(todas);
      expect(sinFiltros.total).toBe(await prisma.cancha.count());
      expect(sinFiltros.total).toBeGreaterThanOrEqual(8);

      const mantenimientoFutbol = await canchas.buscar({ tipo: 'FUTBOL5', estado: 'EN_MANTENIMIENTO', ...todas });
      expect(mantenimientoFutbol.items.every((c) => c.tipo === 'FUTBOL5' && c.estado === 'EN_MANTENIMIENTO')).toBe(true);
      expect(mantenimientoFutbol.total).toBe(
        await prisma.cancha.count({ where: { tipo: 'FUTBOL5', estado: 'EN_MANTENIMIENTO' } }),
      );
      expect(mantenimientoFutbol.total).toBeGreaterThanOrEqual(2);
      // Un sedeId combinado recorta a esa sede aunque el tipo/estado exista en la otra.
      const soloB = await canchas.buscar({ sedeId: b.id, tipo: 'FUTBOL5', estado: 'EN_MANTENIMIENTO', ...todas });
      expect(soloB.items.map((c) => c.id)).toEqual([b.futbolMant.id]);
    });

    it('un sedeId inexistente da lista vacia, no 404', async () => {
      const res = await canchas.buscar({ sedeId: 99999999, ...todas });

      expect(res).toEqual({ items: [], total: 0 });
    });

    it('una combinacion sin coincidencias da lista vacia', async () => {
      const id = await nuevaSede();
      await crear({ tipo: 'PADDLE', costoPorHora: 5000 }, id);

      const res = await canchas.buscar({ sedeId: id, tipo: 'FUTBOL5', ...todas });

      expect(res).toEqual({ items: [], total: 0 });
    });

    it('pagina: total constante, paginas disjuntas y la ultima incompleta', async () => {
      const id = await nuevaSede();
      const creadas: Awaited<ReturnType<typeof crear>>[] = [];
      for (let i = 0; i < 5; i++) {
        creadas.push(await crear({ tipo: 'PADDLE', costoPorHora: 5000 + i }, id));
      }
      const esperados = creadas.map((c) => c.id);

      const p1 = await canchas.buscar({ sedeId: id, page: 1, perPage: 2 });
      const p2 = await canchas.buscar({ sedeId: id, page: 2, perPage: 2 });
      const p3 = await canchas.buscar({ sedeId: id, page: 3, perPage: 2 });
      const p4 = await canchas.buscar({ sedeId: id, page: 4, perPage: 2 });

      expect([p1.total, p2.total, p3.total, p4.total]).toEqual([5, 5, 5, 5]);
      expect(p1.items.map((c) => c.id)).toEqual(esperados.slice(0, 2));
      expect(p2.items.map((c) => c.id)).toEqual(esperados.slice(2, 4));
      expect(p3.items.map((c) => c.id)).toEqual(esperados.slice(4));
      expect(p4.items).toEqual([]);
    });

    // La sede B se crea DESPUES que la A, pero sus canchas se dan de alta primero (y
    // con ids menores): el orden tiene que ser por sede y recien despues por id.
    it('ordena por sede_id y luego por id, aunque las canchas de una sede nueva tengan ids menores', async () => {
      const sedeA = await nuevaSede();
      const sedeB = await nuevaSede();
      const b1 = await crear({ tipo: 'PADDLE', costoPorHora: 5000 }, sedeB);
      const a1 = await crear({ tipo: 'PADDLE', costoPorHora: 5000 }, sedeA);
      const b2 = await crear({ tipo: 'FUTBOL5', costoPorHora: 5000 }, sedeB);
      const a2 = await crear({ tipo: 'FUTBOL5', costoPorHora: 5000 }, sedeA);
      expect(b1.id).toBeLessThan(a1.id);

      // Las dos sedes son las ultimas de la base: sus canchas son las 4 ultimas del
      // listado general. Se piden de a una para no depender del tamano de pagina.
      const total = await prisma.cancha.count();
      const ultimas: number[] = [];
      for (let pagina = total - 3; pagina <= total; pagina++) {
        ultimas.push((await canchas.buscar({ page: pagina, perPage: 1 })).items[0].id);
      }
      expect(ultimas).toEqual([a1.id, a2.id, b1.id, b2.id]);
    });

    it('el orden del listado general es estable entre dos llamadas y estrictamente ascendente', async () => {
      await sedeConCuatro();

      const primera = (await canchas.buscar(todas)).items;
      const segunda = (await canchas.buscar(todas)).items;

      expect(segunda.map((c) => c.id)).toEqual(primera.map((c) => c.id));
      for (let i = 1; i < primera.length; i++) {
        const previo = primera[i - 1];
        const actual = primera[i];
        expect(actual.sedeId > previo.sedeId || (actual.sedeId === previo.sedeId && actual.id > previo.id)).toBe(true);
      }
    });

    it('devuelve costoPorHora como numero (no string de Decimal)', async () => {
      const id = await nuevaSede();
      await crear({ tipo: 'PADDLE', costoPorHora: 7250.5 }, id);

      const res = await canchas.buscar({ sedeId: id, ...todas });

      expect(typeof res.items[0].costoPorHora).toBe('number');
      expect(res.items[0].costoPorHora).toBeCloseTo(7250.5, 2);
    });
  });

  // No regresion: GET /sedes/{sedeId}/canchas sigue exigiendo la sede (404) y ordena igual.
  it('listar por sede sigue dando 404 si la sede no existe y respeta el orden por id', async () => {
    const id = await nuevaSede();
    const primera = await crear({ tipo: 'PADDLE', costoPorHora: 5000 }, id);
    const segunda = await crear({ tipo: 'FUTBOL5', costoPorHora: 5000 }, id);

    const res = await canchas.listar(id, { page: 1, perPage: 100 });

    expect(res.items.map((c) => c.id)).toEqual([primera.id, segunda.id]);
    await expect(canchas.listar(99999999, { page: 1, perPage: 100 })).rejects.toBeInstanceOf(ProblemException);
  });
});
