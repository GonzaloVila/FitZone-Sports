import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/commons/database/prisma.service';
import { ProblemFilter } from '../src/commons/filters/problem.filter';

// Flujo de M4 (bloque 3): canchas -> reservas de turno -> disponibilidad.
//
// Lo que este archivo protege sobre todo son los dos 409 de POST
// /reservas-canchas y el 409 de la cancelacion:
//
//   - turno ocupado (RN-02) y cancha en mantenimiento (RF-12) comparten codigo
//     pero NO pueden devolver el mismo `type`/`detail`: en mantenimiento no
//     hubo concurrencia y el texto "Otro usuario reservo el turno antes que vos"
//     seria falso.
//   - cancelar dos veces es 409 y no 404: la reserva existe y RF-12 conserva el
//     historico, lo que choca es la transition.
//
// El solapamiento se resuelve con exq_reserva_turno (EXCLUSION en la BD), asi que
// estos tests son la unica forma de cubrir de verdad que la constraint existe:
// un `if` en el service los pasaria igual.

describe('M4 - Canchas / Reservas de turno / Disponibilidad (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const sedesCreadas: number[] = [];
  const canchasCreadas: number[] = [];

  const emailUnico = () => `m4.${Date.now()}.${Math.floor(Math.random() * 1000)}@e2e.fitzone.test`;
  const dniUnico = () => String(10000000 + Math.floor(Math.random() * 89999999));

  let sedeId: number;
  let canchaId: number;

  // Horarios con offset explicito -03:00 (Buenos Aires no observa horario de
  // verano): representan sin ambiguedad la hora local de la sede y no dependen
  // del TZ donde corre el test. Se usan dias lejanos para no tocan reservas de
  // otros tests.
  const DIA = '2026-11-12';
  const inicio = (hhmm: string) => `${DIA}T${hhmm}:00-03:00`;
  const fin = (hhmm: string) => `${DIA}T${hhmm}:00-03:00`;

  // Devuelve el id de Usuario, no el de Socio: la FK de Reserva es
  // usuario_id -> Usuario, y la membresia se consulta por el socio del usuario.
  async function crearSocio(opts: { vigente: boolean }): Promise<number> {
    const usuario = await prisma.usuario.create({
      data: {
        rol: 'SOCIO',
        dni: dniUnico(),
        nombre: 'Socio E2E M4',
        email: emailUnico(),
        contrasenia: 'hash-no-relevante',
      },
    });
    usuariosCreados.push(usuario.id);

    const socio = await prisma.socio.create({
      data: { usuario_id: usuario.id, sede_origen_id: sedeId, fecha_alta: new Date() },
    });
    sociosCreados.push(socio.id);

    const ahora = new Date();
    const fechaFin = new Date(ahora);
    fechaFin.setDate(fechaFin.getDate() + (opts.vigente ? 30 : -5));

    await prisma.membresia.create({
      data: {
        socio_id: socio.id,
        plan: 'MENSUAL',
        estado: 'ACTIVA',
        fecha_inicio: ahora,
        fecha_fin: fechaFin,
        renueva_automatica: false,
      },
    });

    return usuario.id;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ProblemFilter());
    await app.init();

    prisma = app.get(PrismaService);

    const sede = await prisma.sede.create({
      data: { nombre: 'Sede E2E M4', direccion: 'Calle Falsa 456', aforo_maximo: 50 },
    });
    sedeId = sede.id;
    sedesCreadas.push(sede.id);

    const cancha = await prisma.cancha.create({
      data: { sede_id: sedeId, tipo: 'FUTBOL5', costo_por_hora: 5000, estado: 'OPERATIVA' },
    });
    canchaId = cancha.id;
    canchasCreadas.push(cancha.id);
  });

  afterAll(async () => {
    // Orden inverso a las FKs: pago_reserva -> reserva -> cancha -> membresia ->
    // socio -> usuario -> sede.
    await prisma.pagoReserva.deleteMany({ where: { reserva: { cancha_id: { in: canchasCreadas } } } });
    await prisma.reserva.deleteMany({ where: { cancha_id: { in: canchasCreadas } } });
    await prisma.cancha.deleteMany({ where: { id: { in: canchasCreadas } } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
    await app.close();
  });

  describe('RF-10 / RN-02 / RN-03 - crear reservas', () => {
    it('crea una reserva de externo sin descuento y devuelve el Location', async () => {
      const externo = await prisma.usuario.create({
        data: {
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Externo E2E M4',
          email: emailUnico(),
          contrasenia: 'hash-no-relevante',
        },
      });
      usuariosCreados.push(externo.id);

      const res = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: canchaId,
          usuario_id: externo.id,
          fecha_hora_inicio: inicio('10:00'),
          fecha_hora_fin: fin('11:00'),
        })
        .expect(201);

      expect(res.headers.location).toBe(`/api/v1/reservas-canchas/${res.body.id}`);
      expect(res.body.estado).toBe('CONFIRMADA');
      // RN-03: sin membresia vigente se cotiza como externo (costo plano).
      expect(Number(res.body.precio_aplicado)).toBeCloseTo(5000, 2);
      // El timestamp vuelve en UTC; se compara el instante, no el string.
      expect(new Date(res.body.fecha_hora_inicio).toISOString()).toBe('2026-11-12T13:00:00.000Z');
    });

    it('aplica el descuento de socio con membresia vigente (RN-03)', async () => {
      const socioId = await crearSocio({ vigente: true });

      const res = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: canchaId,
          usuario_id: socioId,
          fecha_hora_inicio: inicio('12:00'),
          fecha_hora_fin: fin('13:00'),
        })
        .expect(201);

      // 15% de descuento sobre 5000, sin pico (12:00-13:00 no entra en 19-21).
      expect(Number(res.body.precio_aplicado)).toBeCloseTo(4250, 2);
    });

    it('cobra como externo a un socio con membresia vencida (RN-03)', async () => {
      const socioId = await crearSocio({ vigente: false });

      const res = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: canchaId,
          usuario_id: socioId,
          fecha_hora_inicio: inicio('14:00'),
          fecha_hora_fin: fin('15:00'),
        })
        .expect(201);

      expect(Number(res.body.precio_aplicado)).toBeCloseTo(5000, 2);
    });

    it('responde 409 turno-ocupado ante un solapamiento parcial (RN-02)', async () => {
      const externo = await prisma.usuario.create({
        data: {
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Solapador E2E M4',
          email: emailUnico(),
          contrasenia: 'hash-no-relevante',
        },
      });
      usuariosCreados.push(externo.id);

      // 12:00-13:00 ya esta tomada por el test del descuento de socio. Este turno
      // empieza 12:30: el unique parcial (cancha_id, fecha_hora_inicio) lo
      // dejaria pasar; exq_reserva_turno no.
      const res = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: canchaId,
          usuario_id: externo.id,
          fecha_hora_inicio: inicio('12:30'),
          fecha_hora_fin: fin('13:30'),
        })
        .expect(409);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.type).toBe('https://fitzone.app/errores/turno-ocupado');
      expect(res.body.status).toBe(409);
      expect(res.body.instance).toBe('/api/v1/reservas-canchas');
    });

    it('permite un turno que termina exactamente cuando arranca el anterior', async () => {
      const externo = await prisma.usuario.create({
        data: {
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Encadenado E2E M4',
          email: emailUnico(),
          contrasenia: 'hash-no-relevante',
        },
      });
      usuariosCreados.push(externo.id);

      // Intervalos semiabiertos [inicio, fin): 13:00 no solapa con 12:00-13:00.
      await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: canchaId,
          usuario_id: externo.id,
          fecha_hora_inicio: inicio('13:00'),
          fecha_hora_fin: fin('14:00'),
        })
        .expect(201);
    });

    it('responde 409 cancha-en-mantenimiento, distinto del turno ocupado (RF-12)', async () => {
      const otra = await prisma.cancha.create({
        data: {
          sede_id: sedeId,
          tipo: 'PADDLE',
          costo_por_hora: 4000,
          estado: 'EN_MANTENIMIENTO',
        },
      });
      canchasCreadas.push(otra.id);

      const externo = await prisma.usuario.create({
        data: {
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Mantenimiento E2E M4',
          email: emailUnico(),
          contrasenia: 'hash-no-relevante',
        },
      });
      usuariosCreados.push(externo.id);

      const res = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: otra.id,
          usuario_id: externo.id,
          fecha_hora_inicio: inicio('10:00'),
          fecha_hora_fin: fin('11:00'),
        })
        .expect(409);

      // Mismo status que el solapamiento, otra causa: el `type` y el `detail`
      // tienen que distinguirlas.
      expect(res.body.type).toBe('https://fitzone.app/errores/cancha-en-mantenimiento');
      expect(res.body.title).toBe('Cancha en mantenimiento');
      expect(res.body.detail).toContain('mantenimiento');
      expect(res.body.detail).not.toContain('Otro usuario');
    });

    it('responde 404 si la cancha no existe y 422 si el rango es invalido', async () => {
      const externo = await prisma.usuario.create({
        data: {
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Errores E2E M4',
          email: emailUnico(),
          contrasenia: 'hash-no-relevante',
        },
      });
      usuariosCreados.push(externo.id);

      await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: 99999999,
          usuario_id: externo.id,
          fecha_hora_inicio: inicio('16:00'),
          fecha_hora_fin: fin('17:00'),
        })
        .expect(404);

      // Inicio posterior al fin: el contrato no lo cubre con 4xx, asi que el
      // service responde 422 de dominio.
      const invertido = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: canchaId,
          usuario_id: externo.id,
          fecha_hora_inicio: inicio('18:00'),
          fecha_hora_fin: fin('17:00'),
        })
        .expect(422);
      expect(invertido.body.status).toBe(422);

      // Sin zona horaria: la fecha queda ambigua segun donde corra el server.
      await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: canchaId,
          usuario_id: externo.id,
          fecha_hora_inicio: '2026-11-12T19:00:00',
          fecha_hora_fin: '2026-11-12T20:00:00',
        })
        .expect(422);
    });
  });

  describe('RF-12 - listar y obtener', () => {
    it('sin ?estado= devuelve solo CONFIRMADA y con ?estado=CANCELADA las canceladas', async () => {
      const soloConfirmada = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas?cancha_id=${canchaId}`)
        .expect(200);

      expect(Array.isArray(soloConfirmada.body)).toBe(true);
      expect(soloConfirmada.body.length).toBeGreaterThan(0);
      expect(soloConfirmada.body.every((r: { estado: string }) => r.estado === 'CONFIRMADA')).toBe(true);

      // Se cancela una y tiene que reaparecer solo cuando se la pide explicitamente.
      await request(app.getHttpServer())
        .post(`/api/v1/reservas-canchas/${soloConfirmada.body[0].id}/cancelaciones`)
        .expect(204);

      const canceladas = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas?cancha_id=${canchaId}&estado=CANCELADA`)
        .expect(200);
      expect(canceladas.body.some((r: { id: number }) => r.id === soloConfirmada.body[0].id)).toBe(true);

      const porDefecto = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas?cancha_id=${canchaId}`)
        .expect(200);
      expect(porDefecto.body.some((r: { id: number }) => r.id === soloConfirmada.body[0].id)).toBe(false);
    });

    it('filtra por dia de la sede y pagina', async () => {
      const delDia = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas?cancha_id=${canchaId}&fecha=${DIA}`)
        .expect(200);
      expect(delDia.body.length).toBeGreaterThan(0);
      // Todo lo devuelto arranca dentro del dia consultado.
      for (const r of delDia.body) {
        expect(new Date(r.fecha_hora_inicio).toISOString().slice(0, 10)).toBe('2026-11-12');
      }

      const primera = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas?cancha_id=${canchaId}&page=1&per_page=1`)
        .expect(200);
      expect(primera.body).toHaveLength(1);
    });

    it('GET por id devuelve la reserva y 404 si no existe', async () => {
      const creada = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas?cancha_id=${canchaId}&page=1&per_page=1`)
        .expect(200);

      const detalle = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas/${creada.body[0].id}`)
        .expect(200);
      expect(detalle.body.id).toBe(creada.body[0].id);

      await request(app.getHttpServer()).get('/api/v1/reservas-canchas/99999999').expect(404);
    });
  });

  describe('cancelacion', () => {
    it('cancela una CONFIRMADA con 204 y sin cuerpo', async () => {
      const externa = await prisma.usuario.create({
        data: {
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Cancelable E2E M4',
          email: emailUnico(),
          contrasenia: 'hash-no-relevante',
        },
      });
      usuariosCreados.push(externa.id);

      const creada = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: canchaId,
          usuario_id: externa.id,
          fecha_hora_inicio: inicio('08:00'),
          fecha_hora_fin: fin('09:00'),
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/reservas-canchas/${creada.body.id}/cancelaciones`)
        .expect(204);
      expect(res.body).toEqual({});

      // El historico se conserva: GET sigue respondiendo 200 con CANCELADA.
      const detalle = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas/${creada.body.id}`)
        .expect(200);
      expect(detalle.body.estado).toBe('CANCELADA');
    });

    it('cancelar dos veces responde 409 reserva-ya-cancelada, no 404', async () => {
      const externa = await prisma.usuario.create({
        data: {
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Doble cancelacion E2E M4',
          email: emailUnico(),
          contrasenia: 'hash-no-relevante',
        },
      });
      usuariosCreados.push(externa.id);

      const creada = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: canchaId,
          usuario_id: externa.id,
          fecha_hora_inicio: inicio('09:00'),
          fecha_hora_fin: fin('10:00'),
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/reservas-canchas/${creada.body.id}/cancelaciones`)
        .expect(204);

      const segunda = await request(app.getHttpServer())
        .post(`/api/v1/reservas-canchas/${creada.body.id}/cancelaciones`)
        .expect(409);

      expect(segunda.body.type).toBe('https://fitzone.app/errores/reserva-ya-cancelada');
      expect(segunda.body.title).toBe('Reserva ya cancelada');
      expect(segunda.body.detail).toContain(String(creada.body.id));
    });

    it('el horario de una reserva cancelada queda libre para otro usuario', async () => {
      const uno = await prisma.usuario.create({
        data: {
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Libera E2E M4',
          email: emailUnico(),
          contrasenia: 'hash-no-relevante',
        },
      });
      const otro = await prisma.usuario.create({
        data: {
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Reutiliza E2E M4',
          email: emailUnico(),
          contrasenia: 'hash-no-relevante',
        },
      });
      usuariosCreados.push(uno.id, otro.id);

      const primera = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: canchaId,
          usuario_id: uno.id,
          fecha_hora_inicio: inicio('15:00'),
          fecha_hora_fin: fin('16:00'),
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/reservas-canchas/${primera.body.id}/cancelaciones`)
        .expect(204);

      // exq_reserva_turno excluye las CANCELADA: el mismo horario se puede
      // reservar de nuevo.
      await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: canchaId,
          usuario_id: otro.id,
          fecha_hora_inicio: inicio('15:00'),
          fecha_hora_fin: fin('16:00'),
        })
        .expect(201);
    });

    it('cancelar una reserva inexistente responde 404', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas/99999999/cancelaciones')
        .expect(404);
    });
  });

  describe('RF-12 / RNF-03 - disponibilidad', () => {
    it('marca libre el tramo de una reserva cancelada y ocupado el de una vigente', async () => {
      const usuario = await prisma.usuario.create({
        data: {
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Grilla E2E M4',
          email: emailUnico(),
          contrasenia: 'hash-no-relevante',
        },
      });
      usuariosCreados.push(usuario.id);

      const creada = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: canchaId,
          usuario_id: usuario.id,
          fecha_hora_inicio: inicio('17:00'),
          fecha_hora_fin: fin('18:00'),
        })
        .expect(201);

      // 17:00 de la sede es 20:00Z.
      const tramo = (cuerpo: Array<{ fecha_hora_inicio: string; disponible: boolean }>) =>
        cuerpo.find(
          (e) => new Date(e.fecha_hora_inicio).toISOString() === '2026-11-12T20:00:00.000Z',
        );

      const conOcupada = await request(app.getHttpServer())
        .get(`/api/v1/canchas/${canchaId}/disponibilidad?fecha=${DIA}&per_page=100`)
        .expect(200);
      expect(tramo(conOcupada.body)?.disponible).toBe(false);

      // Al cancelar, el tramo vuelve a estar disponible: la grilla lee solo las
      // reservas vigentes (RF-12 conserva el histórico, no la ocupación).
      await request(app.getHttpServer())
        .post(`/api/v1/reservas-canchas/${creada.body.id}/cancelaciones`)
        .expect(204);

      const conLibre = await request(app.getHttpServer())
        .get(`/api/v1/canchas/${canchaId}/disponibilidad?fecha=${DIA}&per_page=100`)
        .expect(200);
      expect(tramo(conLibre.body)?.disponible).toBe(true);
    });

    it('devuelve el dia completo en orden y pagina sin repetir ni perder', async () => {
      const dia = await request(app.getHttpServer())
        .get(`/api/v1/canchas/${canchaId}/disponibilidad?fecha=${DIA}&per_page=100`)
        .expect(200);

      // Grilla de 08:00 a 22:00 en pasos de 60 minutos.
      expect(dia.body).toHaveLength(14);
      for (let i = 1; i < dia.body.length; i++) {
        expect(new Date(dia.body[i].fecha_hora_inicio).getTime()).toBeGreaterThan(
          new Date(dia.body[i - 1].fecha_hora_inicio).getTime(),
        );
      }

      const paginada = await request(app.getHttpServer())
        .get(`/api/v1/canchas/${canchaId}/disponibilidad?fecha=${DIA}&page=2&per_page=7`)
        .expect(200);
      expect(paginada.body).toHaveLength(7);
      expect(paginada.body[0].fecha_hora_inicio).toBe(dia.body[7].fecha_hora_inicio);
    });

    it('una cancha en mantenimiento devuelve todos los tramos ocupados sin tocar sus reservas (RF-12)', async () => {
      const conReserva = await prisma.cancha.create({
        data: { sede_id: sedeId, tipo: 'PADDLE', costo_por_hora: 3000, estado: 'OPERATIVA' },
      });
      canchasCreadas.push(conReserva.id);

      const usuario = await prisma.usuario.create({
        data: {
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Inhabilitada E2E M4',
          email: emailUnico(),
          contrasenia: 'hash-no-relevante',
        },
      });
      usuariosCreados.push(usuario.id);

      const reserva = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          cancha_id: conReserva.id,
          usuario_id: usuario.id,
          fecha_hora_inicio: inicio('11:00'),
          fecha_hora_fin: fin('12:00'),
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/canchas/${conReserva.id}`)
        .send({ estado: 'EN_MANTENIMIENTO' })
        .expect(200);

      const grilla = await request(app.getHttpServer())
        .get(`/api/v1/canchas/${conReserva.id}/disponibilidad?fecha=${DIA}&per_page=100`)
        .expect(200);
      expect(grilla.body.every((e: { disponible: boolean }) => e.disponible === false)).toBe(true);

      // Ponerla en mantenimiento no borra lo ya reservado (RF-12).
      const sigue = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas/${reserva.body.id}`)
        .expect(200);
      expect(sigue.body.estado).toBe('CONFIRMADA');
    });

    it('responde 422 con una fecha invalida y 404 con una cancha inexistente', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/canchas/${canchaId}/disponibilidad?fecha=2026-02-30`)
        .expect(422);

      await request(app.getHttpServer())
        .get('/api/v1/canchas/99999999/disponibilidad?fecha=2026-11-12')
        .expect(404);
    });
  });
});
