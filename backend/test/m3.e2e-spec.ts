import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/commons/database/prisma.service';
import { ProblemFilter } from '../src/commons/filters/problem.filter';

// Flujo completo de M3:
// 1) RF-06: Alta de clases, listado con aforo disponible y detalle.
// 2) RF-07: Reservas con ventana de 48 hs, cancelación hasta 2 hs antes y bloqueo por mora.
// 3) RF-08: Lista de espera cuando la clase está llena, baja lógica (CANCELADO),
//           notificación vía Observer al liberarse un lugar y confirmación first-come.
// 4) Concurrencia / Locks: Verificación atómica de que nunca se sobrepase la capacidad.

describe('M3 - Clases Grupales / Reservas / Lista de Espera (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sedeId: number;

  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const clasesCreadas: number[] = [];

  const emailUnico = () => `m3.${Date.now()}.${Math.floor(Math.random() * 100000)}@e2e.fitzone.test`;
  const dniUnico = () => String(10000000 + Math.floor(Math.random() * 89999999));

  async function crearSocioConMembresia(opts: { vigente: boolean; sedeOrigenId: number }) {
    const usuario = await prisma.usuario.create({
      data: {
        rol: 'SOCIO',
        dni: dniUnico(),
        nombre: 'Socio E2E M3',
        email: emailUnico(),
        contrasenia: 'hash-no-relevante',
      },
    });
    usuariosCreados.push(usuario.id);

    const socio = await prisma.socio.create({
      data: {
        usuario_id: usuario.id,
        sede_id: opts.sedeOrigenId,
        fecha_alta: new Date(),
      },
    });
    sociosCreados.push(socio.id);

    const ahora = new Date();
    const fechaFin = new Date(ahora);
    fechaFin.setDate(fechaFin.getDate() + (opts.vigente ? 30 : -5));

    await prisma.membresia.create({
      data: {
        socio_id: socio.id,
        plan: 'MENSUAL',
        estado: opts.vigente ? 'ACTIVA' : 'VENCIDA',
        fecha_inicio: new Date(ahora.getTime() - 15 * 86400000),
        fecha_fin: fechaFin,
        renueva_automatica: false,
      },
    });

    return { usuarioId: usuario.id, socioId: socio.id };
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
      data: {
        nombre: 'Sede E2E Clases',
        direccion: 'Av. Corrientes 1234',
        aforo_maximo: 100,
      },
    });
    sedeId = sede.id;
  });

  afterAll(async () => {
    // Limpieza en orden inverso a las foreign keys
    await prisma.esperaClase.deleteMany({ where: { clase_id: { in: clasesCreadas } } });
    await prisma.reservaClase.deleteMany({ where: { clase_id: { in: clasesCreadas } } });
    await prisma.clase.deleteMany({ where: { id: { in: clasesCreadas } } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.delete({ where: { id: sedeId } });
    await app.close();
  });

  describe('RF-06: Gestión de Agenda', () => {
    it('POST /clases crea una clase y GET /clases la lista con cupo disponible', async () => {
      const fechaClase = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

      const resCrear = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sede_id: sedeId,
          tipo: 'Spinning',
          instructor: 'Martín Palermo',
          horario: fechaClase,
          capacidad: 20,
        })
        .expect(201);

      const claseId: number = resCrear.body.id;
      clasesCreadas.push(claseId);

      expect(resCrear.headers.location).toBe(`/api/v1/clases/${claseId}`);
      expect(resCrear.body.cupo_disponible).toBe(20);
      expect(resCrear.body.reservas_confirmadas).toBe(0);

      const resListar = await request(app.getHttpServer())
        .get(`/api/v1/clases?sede_id=${sedeId}&tipo=Spinning`)
        .expect(200);

      expect(Array.isArray(resListar.body)).toBe(true);
      const claseEncontrada = resListar.body.find((c: { id: number }) => c.id === claseId);
      expect(claseEncontrada).toBeDefined();
      expect(claseEncontrada.instructor).toBe('Martín Palermo');
    });

    it('POST /clases con sede inexistente responde 404', async () => {
      const fechaClase = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

      await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sede_id: 999999,
          tipo: 'Yoga',
          instructor: 'Buda',
          horario: fechaClase,
          capacidad: 10,
        })
        .expect(404);
    });

    it('POST /clases con horario pasado responde 422', async () => {
      const fechaPasada = new Date(Date.now() - 3600 * 1000).toISOString();

      await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sede_id: sedeId,
          tipo: 'Pilates',
          instructor: 'Laura',
          horario: fechaPasada,
          capacidad: 15,
        })
        .expect(422);
    });
  });

  describe('RF-07: Reserva y Cancelación de Clases', () => {
    it('reserva exitosa dentro de las 48 hs previas decrementa el cupo disponible', async () => {
      const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      // Clase en 24 horas (dentro de la ventana de 48 hs)
      const fechaClase = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sede_id: sedeId,
          tipo: 'CrossFit',
          instructor: 'Franco Colapinto',
          horario: fechaClase,
          capacidad: 10,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      const resReserva = await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/reservas`)
        .send({ socio_id: socioId })
        .expect(201);

      expect(resReserva.headers.location).toBe(`/api/v1/reservas-clases/${resReserva.body.id}`);
      expect(resReserva.body.estado).toBe('CONFIRMADA');

      // Consultar la clase: ahora debe tener 1 confirmada y 9 disponibles
      const resDetalle = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}`)
        .expect(200);

      expect(resDetalle.body.reservas_confirmadas).toBe(1);
      expect(resDetalle.body.cupo_disponible).toBe(9);
    });

    it('intento de reserva fuera de la ventana de 48 hs (ej. en 5 días) responde 422', async () => {
      const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      // Clase en 120 horas (> 48 hs)
      const fechaClase = new Date(Date.now() + 120 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sede_id: sedeId,
          tipo: 'Funcional',
          instructor: 'Esteban',
          horario: fechaClase,
          capacidad: 10,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/reservas`)
        .send({ socio_id: socioId })
        .expect(422);
    });

    it('socio en mora (membresía vencida) no puede reservar con descuento (403)', async () => {
      const { socioId } = await crearSocioConMembresia({ vigente: false, sedeOrigenId: sedeId });

      const fechaClase = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sede_id: sedeId,
          tipo: 'Zumba',
          instructor: 'Mariana',
          horario: fechaClase,
          capacidad: 10,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/reservas`)
        .send({ socio_id: socioId })
        .expect(403);
    });

    it('reserva duplicada para el mismo socio responde 409', async () => {
      const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      const fechaClase = new Date(Date.now() + 20 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sede_id: sedeId,
          tipo: 'GAP',
          instructor: 'Carla',
          horario: fechaClase,
          capacidad: 10,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      // Primera reserva exitosa
      await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/reservas`)
        .send({ socio_id: socioId })
        .expect(201);

      // Segunda reserva responde 409 Conflict
      await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/reservas`)
        .send({ socio_id: socioId })
        .expect(409);
    });

    it('cancelación sin penalidad con >= 2 hs de anticipación responde 204 y libera cupo', async () => {
      const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      // Clase en 5 horas (> 2 hs)
      const fechaClase = new Date(Date.now() + 5 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sede_id: sedeId,
          tipo: 'Boxeo',
          instructor: 'Sergio Maravilla',
          horario: fechaClase,
          capacidad: 5,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      const resReserva = await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/reservas`)
        .send({ socio_id: socioId })
        .expect(201);

      const reservaId: number = resReserva.body.id;

      // Cancelación exitosa
      await request(app.getHttpServer())
        .delete(`/api/v1/reservas-clases/${reservaId}`)
        .expect(204);

      // La reserva queda en estado CANCELADA
      const resConsulta = await request(app.getHttpServer())
        .get(`/api/v1/reservas-clases/${reservaId}`)
        .expect(200);

      expect(resConsulta.body.estado).toBe('CANCELADA');
    });

    it('cancelación con < 2 hs de anticipación responde 409 (cancelación fuera de término)', async () => {
      const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      // Clase en 1 hora (< 2 hs)
      const fechaClase = new Date(Date.now() + 1 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sede_id: sedeId,
          tipo: 'Spinning Exprés',
          instructor: 'Lucas',
          horario: fechaClase,
          capacidad: 5,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      const resReserva = await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/reservas`)
        .send({ socio_id: socioId })
        .expect(201);

      const reservaId: number = resReserva.body.id;

      await request(app.getHttpServer())
        .delete(`/api/v1/reservas-clases/${reservaId}`)
        .expect(409);
    });
  });

  describe('RF-08: Lista de Espera, Patrón Observer y First-Come', () => {
    it('flujo completo: clase llena -> socio en espera -> cancelación dispara Observer -> confirmación first-come', async () => {
      const socioA = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      const socioB = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      // Clase con capacidad 1 en 6 horas
      const fechaClase = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sede_id: sedeId,
          tipo: 'TRX Intensivo',
          instructor: 'Javier',
          horario: fechaClase,
          capacidad: 1,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      // Intento de entrar a lista de espera cuando la clase tiene cupo disponible responde 409
      await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/espera`)
        .send({ socio_id: socioB.socioId })
        .expect(409);

      // Socio A reserva el único cupo disponible
      const resReservaA = await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/reservas`)
        .send({ socio_id: socioA.socioId })
        .expect(201);

      const reservaIdA: number = resReservaA.body.id;

      // Ahora que la clase está llena, Socio B se anota en lista de espera
      const resEsperaB = await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/espera`)
        .send({ socio_id: socioB.socioId })
        .expect(201);

      const esperaIdB: number = resEsperaB.body.id;
      expect(resEsperaB.body.estado).toBe('EN_ESPERA');
      expect(resEsperaB.headers.location).toBe(`/api/v1/esperas-clases/${esperaIdB}`);

      // Socio B intenta confirmar antes de ser notificado -> 409
      await request(app.getHttpServer())
        .post(`/api/v1/esperas-clases/${esperaIdB}/confirmacion`)
        .expect(409);

      // Socio A cancela su reserva con > 2 hs de anticipación
      await request(app.getHttpServer())
        .delete(`/api/v1/reservas-clases/${reservaIdA}`)
        .expect(204);

      // Verificamos que el Observer actualizó a Socio B a estado NOTIFICADO
      const resEsperaActualizada = await request(app.getHttpServer())
        .get(`/api/v1/esperas-clases/${esperaIdB}`)
        .expect(200);

      expect(resEsperaActualizada.body.estado).toBe('NOTIFICADO');
      expect(resEsperaActualizada.body.fecha_notificacion).not.toBeNull();

      // Socio B confirma el cupo liberado (First-Come)
      await request(app.getHttpServer())
        .post(`/api/v1/esperas-clases/${esperaIdB}/confirmacion`)
        .expect(204);

      // La espera pasa a CONFIRMADO
      const resEsperaConfirmada = await request(app.getHttpServer())
        .get(`/api/v1/esperas-clases/${esperaIdB}`)
        .expect(200);

      expect(resEsperaConfirmada.body.estado).toBe('CONFIRMADO');
      expect(resEsperaConfirmada.body.fecha_confirmacion).not.toBeNull();

      // Socio B ahora tiene una ReservaClase confirmada
      const reservaB = await prisma.reservaClase.findFirst({
        where: { clase_id: claseId, socio_id: socioB.socioId, estado: 'CONFIRMADA' },
      });
      expect(reservaB).toBeDefined();
    });

    it('baja lógica de lista de espera actualiza el estado a CANCELADO', async () => {
      const socioA = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      const socioB = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      const fechaClase = new Date(Date.now() + 10 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sede_id: sedeId,
          tipo: 'Calistenia',
          instructor: 'Nico',
          horario: fechaClase,
          capacidad: 1,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      // Socio A llena la clase
      await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/reservas`)
        .send({ socio_id: socioA.socioId })
        .expect(201);

      // Socio B se anota en espera
      const resEspera = await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/espera`)
        .send({ socio_id: socioB.socioId })
        .expect(201);

      const esperaId: number = resEspera.body.id;

      // Socio B decide salir de la lista de espera
      await request(app.getHttpServer())
        .delete(`/api/v1/esperas-clases/${esperaId}`)
        .expect(204);

      // Verificamos baja lógica
      const resConsulta = await request(app.getHttpServer())
        .get(`/api/v1/esperas-clases/${esperaId}`)
        .expect(200);

      expect(resConsulta.body.estado).toBe('CANCELADO');
    });
  });

  describe('Concurrencia Pesimista (Stress Test)', () => {
    it('10 intentos simultáneos para el último cupo: solo 1 tiene éxito y 9 reciben 409', async () => {
      // Creamos una clase con capacidad para exactamente 1 persona
      const fechaClase = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sede_id: sedeId,
          tipo: 'Spinning VIP',
          instructor: 'Profe Concurrencia',
          horario: fechaClase,
          capacidad: 1,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      // Creamos 10 socios con cuota al día
      const socios = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId }),
        ),
      );

      // Disparamos 10 reservas simultáneamente
      const respuestas = await Promise.all(
        socios.map((s) =>
          request(app.getHttpServer())
            .post(`/api/v1/clases/${claseId}/reservas`)
            .send({ socio_id: s.socioId }),
        ),
      );

      const exitosas = respuestas.filter((r) => r.status === 201);
      const rechazadas = respuestas.filter((r) => r.status === 409);

      // Consistencia absoluta: solo 1 ganador
      expect(exitosas.length).toBe(1);
      expect(rechazadas.length).toBe(9);

      // En base de datos debe haber exactamente 1 reserva confirmada
      const totalEnBd = await prisma.reservaClase.count({
        where: { clase_id: claseId, estado: 'CONFIRMADA' },
      });
      expect(totalEnBd).toBe(1);
    });
  });
});
