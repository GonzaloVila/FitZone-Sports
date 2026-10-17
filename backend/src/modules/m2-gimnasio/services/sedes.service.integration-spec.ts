import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { GimnasioModule } from 'src/modules/m2-gimnasio/gimnasio.module';
import { SedesService } from 'src/modules/m2-gimnasio/services/sedes.service';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

// Integration: alta/listado/existencia de sedes contra la BD real.
describe('M2 SedesService (integration, BD real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let sedes: SedesService;
  const sedesCreadas: number[] = [];

  beforeAll(async () => {
    moduleRef = await crearModuloDeIntegracion(GimnasioModule);
    prisma = moduleRef.get(PrismaService);
    sedes = moduleRef.get(SedesService);
  });

  afterAll(async () => {
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
    await moduleRef.close();
  });

  it('crea una sede y la lista con su aforo máximo', async () => {
    const creada = await sedes.crear({ nombre: 'Sede int M2', direccion: 'Calle 2', aforoMaximo: 42 } as never);
    sedesCreadas.push(creada.id);

    expect(creada).toMatchObject({ nombre: 'Sede int M2', aforoMaximo: 42 });

    const listado = await sedes.listar(1, 100);
    expect(listado.items.map((s) => s.id)).toContain(creada.id);
    expect(listado.total).toBeGreaterThanOrEqual(1);
  });

  it('existe() distingue una sede real de un id inexistente', async () => {
    const creada = await sedes.crear({ nombre: 'Sede int existe', direccion: 'Calle 3', aforoMaximo: 10 } as never);
    sedesCreadas.push(creada.id);

    expect(await sedes.existe(creada.id)).toBe(true);
    expect(await sedes.existe(99999999)).toBe(false);
  });
});
