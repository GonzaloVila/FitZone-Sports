import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp } from '@test/helpers/base-de-datos';
import { crearContextoM3 } from './m3.fixtures';

// Concurrencia / locks: verificación atómica de que nunca se sobrepase la capacidad
// ni se dupliquen reservas o esperas activas.
describe('M3 - Concurrencia y locks', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof crearContextoM3>>;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    ctx = await crearContextoM3(app, prisma);
  });

  afterAll(async () => {
    await ctx.limpiar();
    await app.close();
  });

  async function crearClase(tipo: string, horas: number, capacidad: number): Promise<number> {
    const fechaClase = new Date(Date.now() + horas * 3600 * 1000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/v1/clases')
      .send({
        sedeId: ctx.sedeId,
        tipo,
        instructor: 'Profe',
        horarioInicio: fechaClase,
        horarioFin: ctx.finDe(fechaClase),
        capacidad,
      })
      .expect(201);
    ctx.clasesCreadas.push(res.body.id);
    return res.body.id;
  }

  it('10 intentos simultáneos para el último cupo: solo 1 tiene éxito y 9 reciben 409', async () => {
    const claseId = await crearClase('Spinning VIP', 12, 1);

    const socios = await Promise.all(
      Array.from({ length: 10 }).map(() => ctx.crearSocioConMembresia({ vigente: true })),
    );

    const respuestas = await Promise.all(
      socios.map((s) =>
        request(app.getHttpServer())
          .post('/api/v1/reservas-clases')
          .send({ claseId, socioId: s.socioId }),
      ),
    );

    const exitosas = respuestas.filter((r) => r.status === 201);
    const rechazadas = respuestas.filter((r) => r.status === 409);

    expect(exitosas.length).toBe(1);
    expect(rechazadas.length).toBe(9);

    const totalEnBd = await prisma.reservaClase.count({
      where: { clase_id: claseId, estado: 'CONFIRMADA' },
    });
    expect(totalEnBd).toBe(1);
  });

  it('anotaciones repetidas del mismo socio dejan una sola espera activa y las otras reciben 409', async () => {
    // El findFirst de crear() corre antes del INSERT y sin lock: se fuerza el hueco
    // insertando la segunda espera por Prisma (lo que haria la peticion que gano la
    // carrera). Lo decide el indice parcial unico unq_espera_clase_socio_activa.
    const claseId = await crearClase('Espera Simultanea', 12, 1);

    const ocupante = await ctx.crearSocioConMembresia({ vigente: true });
    await request(app.getHttpServer())
      .post('/api/v1/reservas-clases')
      .send({ claseId, socioId: ocupante.socioId })
      .expect(201);

    const socio = await ctx.crearSocioConMembresia({ vigente: true });

    const resAlta = await request(app.getHttpServer())
      .post(`/api/v1/clases/${claseId}/espera`)
      .send({ socioId: socio.socioId })
      .expect(201);

    await expect(
      prisma.esperaClase.create({
        data: {
          clase_id: claseId,
          socio_id: socio.socioId,
          estado: 'EN_ESPERA',
          fecha_anotacion: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const resRepetida = await request(app.getHttpServer())
      .post(`/api/v1/clases/${claseId}/espera`)
      .send({ socioId: socio.socioId })
      .expect(409);
    expect(resRepetida.body.type).toBe('https://fitzone.app/errores/espera-existente');

    const totalEnBd = await prisma.esperaClase.count({
      where: { clase_id: claseId, socio_id: socio.socioId, estado: { in: ['EN_ESPERA', 'NOTIFICADO'] } },
    });
    expect(totalEnBd).toBe(1);
    expect(resAlta.body.estado).toBe('EN_ESPERA');
  });

  it('un socio que dio de baja puede volver a anotarse en la misma clase', async () => {
    // El indice parcial solo cubre EN_ESPERA y NOTIFICADO: CANCELADO queda fuera.
    const claseId = await crearClase('Reinscripcion Espera', 12, 1);

    const ocupante = await ctx.crearSocioConMembresia({ vigente: true });
    await request(app.getHttpServer())
      .post('/api/v1/reservas-clases')
      .send({ claseId, socioId: ocupante.socioId })
      .expect(201);

    const socio = await ctx.crearSocioConMembresia({ vigente: true });

    const resAlta = await request(app.getHttpServer())
      .post(`/api/v1/clases/${claseId}/espera`)
      .send({ socioId: socio.socioId })
      .expect(201);
    const esperaId: number = resAlta.body.id;

    await request(app.getHttpServer()).delete(`/api/v1/esperas-clases/${esperaId}`).expect(204);

    const resReinscripcion = await request(app.getHttpServer())
      .post(`/api/v1/clases/${claseId}/espera`)
      .send({ socioId: socio.socioId })
      .expect(201);

    expect(resReinscripcion.body.id).not.toBe(esperaId);
    expect(resReinscripcion.body.estado).toBe('EN_ESPERA');
  });
});
