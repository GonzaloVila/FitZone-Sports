import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { EmailCupoLiberadoObserver } from 'src/modules/m3-clases/observers/email-cupo-liberado.observer';
import { crearApp } from '@test/helpers/base-de-datos';
import { crearContextoM3 } from './m3.fixtures';

// RF-08: lista de espera cuando la clase está llena, baja lógica (CANCELADO),
// notificación vía Observer al liberarse un lugar y confirmación first-come.
describe('M3 - Lista de espera y Observer (RF-08)', () => {
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

  it('flujo completo: clase llena -> socio en espera -> cancelación dispara Observer -> confirmación first-come', async () => {
    const socioA = await ctx.crearSocioConMembresia({ vigente: true });
    const socioB = await ctx.crearSocioConMembresia({ vigente: true });
    const claseId = await crearClase('TRX Intensivo', 6, 1);

    // Intento de entrar a lista de espera cuando la clase tiene cupo disponible -> 409
    await request(app.getHttpServer())
      .post(`/api/v1/clases/${claseId}/espera`)
      .send({ socioId: socioB.socioId })
      .expect(409);

    // Socio A reserva el único cupo disponible
    const resReservaA = await request(app.getHttpServer())
      .post('/api/v1/reservas-clases')
      .send({ claseId, socioId: socioA.socioId })
      .expect(201);
    const reservaIdA: number = resReservaA.body.id;

    // Ahora que la clase está llena, Socio B se anota en lista de espera
    const resEsperaB = await request(app.getHttpServer())
      .post(`/api/v1/clases/${claseId}/espera`)
      .send({ socioId: socioB.socioId })
      .expect(201);
    const esperaIdB: number = resEsperaB.body.id;
    expect(resEsperaB.body.estado).toBe('EN_ESPERA');
    expect(resEsperaB.headers.location).toBe(`/api/v1/esperas-clases/${esperaIdB}`);

    // Socio B intenta confirmar antes de ser notificado -> 409
    await request(app.getHttpServer())
      .post(`/api/v1/esperas-clases/${esperaIdB}/confirmaciones`)
      .expect(409);

    // Espiamos el observer de EMAIL para probar que el canal corre, no solo el estado.
    const emailObserver = app.get(EmailCupoLiberadoObserver);
    const spyEmail = vi.spyOn(emailObserver, 'notificarCupoDisponible');

    // Socio A cancela su reserva con > 2 hs de anticipación
    await request(app.getHttpServer())
      .post(`/api/v1/reservas-clases/${reservaIdA}/cancelaciones`)
      .expect(204);

    expect(spyEmail).toHaveBeenCalledTimes(1);
    expect(spyEmail).toHaveBeenCalledWith(
      expect.objectContaining({ claseId, nombreClase: 'TRX Intensivo' }),
    );

    // El Observer actualizó a Socio B a NOTIFICADO
    const resEsperaActualizada = await request(app.getHttpServer())
      .get(`/api/v1/esperas-clases/${esperaIdB}`)
      .expect(200);
    expect(resEsperaActualizada.body.estado).toBe('NOTIFICADO');
    expect(resEsperaActualizada.body.fechaNotificacion).not.toBeNull();

    // Socio B confirma el cupo liberado (First-Come)
    const resConfirmada = await request(app.getHttpServer())
      .post(`/api/v1/esperas-clases/${esperaIdB}/confirmaciones`)
      .expect(201);
    expect(resConfirmada.body.estado).toBe('CONFIRMADA');
    expect(resConfirmada.body.claseId).toBe(claseId);
    expect(resConfirmada.body.socioId).toBe(socioB.socioId);
    expect(resConfirmada.body.id).toEqual(expect.any(Number));
    expect(resConfirmada.headers.location).toBe(`/api/v1/reservas-clases/${resConfirmada.body.id}`);

    const resEsperaConfirmada = await request(app.getHttpServer())
      .get(`/api/v1/esperas-clases/${esperaIdB}`)
      .expect(200);
    expect(resEsperaConfirmada.body.estado).toBe('CONFIRMADO');
    expect(resEsperaConfirmada.body.fechaConfirmacion).not.toBeNull();

    const reservaB = await prisma.reservaClase.findFirst({
      where: { clase_id: claseId, socio_id: socioB.socioId, estado: 'CONFIRMADA' },
    });
    expect(reservaB).toBeDefined();
    expect(reservaB!.id).toBe(resConfirmada.body.id);
  });

  it('baja lógica de lista de espera actualiza el estado a CANCELADO', async () => {
    const socioA = await ctx.crearSocioConMembresia({ vigente: true });
    const socioB = await ctx.crearSocioConMembresia({ vigente: true });
    const claseId = await crearClase('Calistenia', 10, 1);

    await request(app.getHttpServer())
      .post('/api/v1/reservas-clases')
      .send({ claseId, socioId: socioA.socioId })
      .expect(201);

    const resEspera = await request(app.getHttpServer())
      .post(`/api/v1/clases/${claseId}/espera`)
      .send({ socioId: socioB.socioId })
      .expect(201);
    const esperaId: number = resEspera.body.id;

    await request(app.getHttpServer()).delete(`/api/v1/esperas-clases/${esperaId}`).expect(204);

    const resConsulta = await request(app.getHttpServer())
      .get(`/api/v1/esperas-clases/${esperaId}`)
      .expect(200);
    expect(resConsulta.body.estado).toBe('CANCELADO');
  });
});
