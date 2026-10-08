import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/commons/database/prisma.service';
import { ProblemFilter } from '../src/commons/filters/problem.filter';
import { PRECIOS_PLAN } from '../src/modules/m1-usuarios/entities/membresia.entity';
import { penalidadCancelacionTardia } from '../src/modules/m3-clases/entities/reserva-clase.entity';

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
  const pagosDePenalidad: number[] = [];
  const reservasClasesConPenalidad: number[] = [];

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
        sede_origen_id: opts.sedeOrigenId,
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
        precio: PRECIOS_PLAN.MENSUAL,
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
    // La cancelación tardía (RF-07) cobra una penalidad como Pago (concepto
    // RESERVA_CLASE) que referencia la reserva: se limpia ANTES que la reserva,
    // porque la FK de PagoReservaClase es restrict.
    await prisma.pagoReservaClase.deleteMany({
      where: { reserva_clase_id: { in: reservasClasesConPenalidad } },
    });
    await prisma.pago.deleteMany({ where: { id: { in: pagosDePenalidad } } });
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
          sedeId: sedeId,
          tipo: 'Spinning',
          instructor: 'Martín Palermo',
          horario: fechaClase,
          capacidad: 20,
        })
        .expect(201);

      const claseId: number = resCrear.body.id;
      clasesCreadas.push(claseId);

      expect(resCrear.headers.location).toBe(`/api/v1/clases/${claseId}`);
      expect(resCrear.body.cupoDisponible).toBe(20);
      expect(resCrear.body.reservasConfirmadas).toBe(0);

      const resListar = await request(app.getHttpServer())
        .get(`/api/v1/clases?sedeId=${sedeId}&tipo=Spinning`)
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
          sedeId: 999999,
          tipo: 'Yoga',
          instructor: 'Buda',
          horario: fechaClase,
          capacidad: 10,
        })
        .expect(404);
    });

    it('POST /clases con horario pasado responde 409', async () => {
      const fechaPasada = new Date(Date.now() - 3600 * 1000).toISOString();

      await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
          tipo: 'Pilates',
          instructor: 'Laura',
          horario: fechaPasada,
          capacidad: 15,
        })
        .expect(409);
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
          sedeId: sedeId,
          tipo: 'CrossFit',
          instructor: 'Franco Colapinto',
          horario: fechaClase,
          capacidad: 10,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      const resReserva = await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioId })
        .expect(201);

      expect(resReserva.headers.location).toBe(`/api/v1/reservas-clases/${resReserva.body.id}`);
      expect(resReserva.body.estado).toBe('CONFIRMADA');

      // Consultar la clase: ahora debe tener 1 confirmada y 9 disponibles
      const resDetalle = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}`)
        .expect(200);

      expect(resDetalle.body.reservasConfirmadas).toBe(1);
      expect(resDetalle.body.cupoDisponible).toBe(9);
    });

    it('intento de reserva fuera de la ventana de 48 hs (ej. en 5 días) responde 409', async () => {
      const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      // Clase en 120 horas (> 48 hs)
      const fechaClase = new Date(Date.now() + 120 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
          tipo: 'Funcional',
          instructor: 'Esteban',
          horario: fechaClase,
          capacidad: 10,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioId })
        .expect(409);
    });

    it('socio en mora (membresía vencida) no puede reservar con descuento (403)', async () => {
      const { socioId } = await crearSocioConMembresia({ vigente: false, sedeOrigenId: sedeId });

      const fechaClase = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
          tipo: 'Zumba',
          instructor: 'Mariana',
          horario: fechaClase,
          capacidad: 10,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioId })
        .expect(403);
    });

    it('reserva duplicada para el mismo socio responde 409', async () => {
      const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      const fechaClase = new Date(Date.now() + 20 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
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
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioId })
        .expect(201);

      // Segunda reserva responde 409 Conflict
      await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioId })
        .expect(409);
    });

    it('cancelación sin penalidad con >= 2 hs de anticipación responde 204 y libera cupo', async () => {
      const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      // Clase en 5 horas (> 2 hs)
      const fechaClase = new Date(Date.now() + 5 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
          tipo: 'Boxeo',
          instructor: 'Sergio Maravilla',
          horario: fechaClase,
          capacidad: 5,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      const resReserva = await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioId })
        .expect(201);

      const reservaId: number = resReserva.body.id;

      // Cancelación exitosa
      await request(app.getHttpServer())
        .post(`/api/v1/reservas-clases/${reservaId}/cancelaciones`)
        .expect(204);

      // La reserva queda en estado CANCELADA
      const resConsulta = await request(app.getHttpServer())
        .get(`/api/v1/reservas-clases/${reservaId}`)
        .expect(200);

      expect(resConsulta.body.estado).toBe('CANCELADA');
    });

    it('cancelación con < 2 hs de anticipación se permite y cobra la penalidad (RF-07)', async () => {
      const { socioId } = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      // Clase en 1 hora (< 2 hs)
      const fechaClase = new Date(Date.now() + 1 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
          tipo: 'Spinning Exprés',
          instructor: 'Lucas',
          horario: fechaClase,
          capacidad: 5,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      const resReserva = await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioId })
        .expect(201);

      const reservaId: number = resReserva.body.id;
      reservasClasesConPenalidad.push(reservaId);

      // Ya no es 409: la cancelación se permite y se cobra el 50% del valor nominal.
      await request(app.getHttpServer())
        .post(`/api/v1/reservas-clases/${reservaId}/cancelaciones`)
        .expect(204);

      const pago = await prisma.pago.findFirst({
        where: { pago_reserva_clase: { reserva_clase_id: reservaId } },
      });

      expect(pago).not.toBeNull();
      expect(pago!.estado).toBe('APROBADO');
      expect(pago!.monto.toNumber()).toBe(penalidadCancelacionTardia());
      expect(pago!.comprobantePdfUrl).not.toBeNull();
      pagosDePenalidad.push(pago!.id);

      // El comprobante también existe: la penalidad es un pago real (RF-14).
      const resComprobante = await request(app.getHttpServer())
        .get(`/api/v1/pagos/${pago!.id}/comprobante`)
        .expect(200);
      expect((resComprobante.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

      // La reserva queda cancelada igual que la cancelación sin penalidad.
      const resConsulta = await request(app.getHttpServer())
        .get(`/api/v1/reservas-clases/${reservaId}`)
        .expect(200);
      expect(resConsulta.body.estado).toBe('CANCELADA');
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
          sedeId: sedeId,
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
        .send({ socioId: socioB.socioId })
        .expect(409);

      // Socio A reserva el único cupo disponible
      const resReservaA = await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioA.socioId })
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

      // Socio A cancela su reserva con > 2 hs de anticipación
      await request(app.getHttpServer())
        .post(`/api/v1/reservas-clases/${reservaIdA}/cancelaciones`)
        .expect(204);

      // Verificamos que el Observer actualizó a Socio B a estado NOTIFICADO
      const resEsperaActualizada = await request(app.getHttpServer())
        .get(`/api/v1/esperas-clases/${esperaIdB}`)
        .expect(200);

      expect(resEsperaActualizada.body.estado).toBe('NOTIFICADO');
      expect(resEsperaActualizada.body.fechaNotificacion).not.toBeNull();

      // Socio B confirma el cupo liberado (First-Come)
      const resConfirmada = await request(app.getHttpServer())
        .post(`/api/v1/esperas-clases/${esperaIdB}/confirmaciones`)
        .expect(201);

      // La confirmacion responde 201 con la ReservaClase creada y su Location
      expect(resConfirmada.body.estado).toBe('CONFIRMADA');
      expect(resConfirmada.body.claseId).toBe(claseId);
      expect(resConfirmada.body.socioId).toBe(socioB.socioId);
      expect(resConfirmada.body.id).toEqual(expect.any(Number));
      expect(resConfirmada.headers.location).toBe(`/api/v1/reservas-clases/${resConfirmada.body.id}`);

      // La espera pasa a CONFIRMADO
      const resEsperaConfirmada = await request(app.getHttpServer())
        .get(`/api/v1/esperas-clases/${esperaIdB}`)
        .expect(200);

      expect(resEsperaConfirmada.body.estado).toBe('CONFIRMADO');
      expect(resEsperaConfirmada.body.fechaConfirmacion).not.toBeNull();

      // Socio B ahora tiene una ReservaClase confirmada, y es la que devolvio el 201
      const reservaB = await prisma.reservaClase.findFirst({
        where: { clase_id: claseId, socio_id: socioB.socioId, estado: 'CONFIRMADA' },
      });
      expect(reservaB).toBeDefined();
      expect(reservaB!.id).toBe(resConfirmada.body.id);
    });

    it('baja lógica de lista de espera actualiza el estado a CANCELADO', async () => {
      const socioA = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      const socioB = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      const fechaClase = new Date(Date.now() + 10 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
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
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioA.socioId })
        .expect(201);

      // Socio B se anota en espera
      const resEspera = await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/espera`)
        .send({ socioId: socioB.socioId })
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

  describe('Listados con filtros y paginación (RF-06 / RF-07 / RF-08)', () => {
    it('GET /clases/{clase_id}/reservas lista, filtra por estado y pagina', async () => {
      const fechaClase = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
          tipo: 'Listado Reservas',
          instructor: 'Profe Listado',
          horario: fechaClase,
          capacidad: 3,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      for (let i = 0; i < 3; i++) {
        const socio = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
        await request(app.getHttpServer())
          .post('/api/v1/reservas-clases')
          .send({ claseId: claseId, socioId: socio.socioId })
          .expect(201);
      }

      const resTodas = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/reservas`)
        .expect(200);

      expect(Array.isArray(resTodas.body)).toBe(true);
      expect(resTodas.body).toHaveLength(3);
      for (const reserva of resTodas.body) {
        expect(reserva.claseId).toBe(claseId);
        expect(reserva.estado).toBe('CONFIRMADA');
        expect(typeof reserva.id).toBe('number');
        expect(typeof reserva.socioId).toBe('number');
      }

      const resConfirmadas = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/reservas?estado=CONFIRMADA`)
        .expect(200);
      expect(resConfirmadas.body).toHaveLength(3);

      const resCanceladas = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/reservas?estado=CANCELADA`)
        .expect(200);
      expect(resCanceladas.body).toHaveLength(0);

      const resPagina1 = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/reservas?perPage=2&page=1`)
        .expect(200);
      expect(resPagina1.body).toHaveLength(2);

      const resPagina2 = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/reservas?perPage=2&page=2`)
        .expect(200);
      expect(resPagina2.body).toHaveLength(1);

      const resPagina3 = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/reservas?perPage=2&page=3`)
        .expect(200);
      expect(resPagina3.body).toHaveLength(0);

      await request(app.getHttpServer())
        .get('/api/v1/clases/999999999/reservas')
        .expect(404);
    });

    it('GET /reservas-clases filtra por clase, socio y estado', async () => {
      const fechaClase = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
          tipo: 'Listado Global Reservas',
          instructor: 'Profe Global',
          horario: fechaClase,
          capacidad: 5,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      const socioA = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      const socioB = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioA.socioId })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioB.socioId })
        .expect(201);

      const resPorClase = await request(app.getHttpServer())
        .get(`/api/v1/reservas-clases?claseId=${claseId}`)
        .expect(200);
      expect(resPorClase.body).toHaveLength(2);

      const resPorSocio = await request(app.getHttpServer())
        .get(`/api/v1/reservas-clases?socioId=${socioA.socioId}`)
        .expect(200);
      expect(resPorSocio.body).toHaveLength(1);
      expect(resPorSocio.body[0].socioId).toBe(socioA.socioId);

      const resPorEstado = await request(app.getHttpServer())
        .get(`/api/v1/reservas-clases?claseId=${claseId}&estado=CONFIRMADA`)
        .expect(200);
      expect(resPorEstado.body).toHaveLength(2);

      const resCombinado = await request(app.getHttpServer())
        .get(`/api/v1/reservas-clases?claseId=${claseId}&socioId=${socioB.socioId}`)
        .expect(200);
      expect(resCombinado.body).toHaveLength(1);
      expect(resCombinado.body[0].socioId).toBe(socioB.socioId);

      await request(app.getHttpServer())
        .get(`/api/v1/reservas-clases?estado=INVALIDO`)
        .expect(422);

      await request(app.getHttpServer())
        .get(`/api/v1/reservas-clases?fecha=2026-10-15`)
        .expect(422);
    });

    it('GET /clases/{clase_id}/espera lista, filtra por estado y pagina', async () => {
      const fechaClase = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
          tipo: 'Listado Espera',
          instructor: 'Profe Espera',
          horario: fechaClase,
          capacidad: 1,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      const socioOcupante = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioOcupante.socioId })
        .expect(201);

      for (let i = 0; i < 2; i++) {
        const socio = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
        await request(app.getHttpServer())
          .post(`/api/v1/clases/${claseId}/espera`)
          .send({ socioId: socio.socioId })
          .expect(201);
      }

      const resTodas = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/espera`)
        .expect(200);

      expect(Array.isArray(resTodas.body)).toBe(true);
      expect(resTodas.body).toHaveLength(2);
      for (const espera of resTodas.body) {
        expect(espera.claseId).toBe(claseId);
        expect(espera.estado).toBe('EN_ESPERA');
        expect(espera.fechaAnotacion).toBeDefined();
        expect(espera.fechaNotificacion).toBeNull();
        expect(espera.fechaConfirmacion).toBeNull();
      }

      const resEnEspera = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/espera?estado=EN_ESPERA`)
        .expect(200);
      expect(resEnEspera.body).toHaveLength(2);

      const resConfirmadas = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/espera?estado=CONFIRMADO`)
        .expect(200);
      expect(resConfirmadas.body).toHaveLength(0);

      const resPagina1 = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/espera?perPage=1&page=1`)
        .expect(200);
      expect(resPagina1.body).toHaveLength(1);

      const resPagina2 = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/espera?perPage=1&page=2`)
        .expect(200);
      expect(resPagina2.body).toHaveLength(1);
      expect(resPagina1.body[0].id).not.toBe(resPagina2.body[0].id);

      await request(app.getHttpServer())
        .get('/api/v1/clases/999999999/espera')
        .expect(404);
    });

    it('GET /clases/{clase_id}/espera pagina sin repetir ni saltear filas cuando varias anotaciones empatan en el mismo milisegundo', async () => {
      // Regresion del desempate por id: fechaAnotacion es TIMESTAMP(3) y la
      // genera la app con new Date(). Con skip/take y un orderBy no unico,
      // PostgreSQL puede devolver las filas del empate en cualquier orden entre
      // paginas, repitiendo una y salteando otra. Aca se fija la misma
      // fechaAnotacion para todos para forzar el empate y exigir orden total.
      const fechaClase = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
          tipo: 'Listado Espera Empate',
          instructor: 'Profe Empate',
          horario: fechaClase,
          capacidad: 1,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      const socioOcupante = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioOcupante.socioId })
        .expect(201);

      const CANTIDAD = 4;
      for (let i = 0; i < CANTIDAD; i++) {
        const socio = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
        await request(app.getHttpServer())
          .post(`/api/v1/clases/${claseId}/espera`)
          .send({ socioId: socio.socioId })
          .expect(201);
      }

      // Empate forzado: las cuatro quedan con la misma fechaAnotacion.
      const empate = new Date('2026-01-02T03:04:05.678Z');
      await prisma.esperaClase.updateMany({
        where: { clase_id: claseId },
        data: { fecha_anotacion: empate },
      });

      // Solo con el empate no alcanza: un seq scan devuelve orden de heap, que
      // coincide con el id, asi que el test pasaria aunque faltara el desempate.
      // Se reescriben las filas en orden inverso al id (cada UPDATE mueve la
      // version de tupla al final de la pagina) para que el orden fisico quede
      // al reves del id. Ahi el sort de PostgreSQL, que no es estable, devuelve
      // las empates en orden de heap y la paginacion se rompe de verdad.
      const filas = await prisma.esperaClase.findMany({
        where: { clase_id: claseId },
        orderBy: { id: 'desc' },
        select: { id: true },
      });
      for (const fila of filas) {
        await prisma.esperaClase.update({
          where: { id: fila.id },
          data: { fecha_notificacion: new Date() },
        });
        await prisma.esperaClase.update({
          where: { id: fila.id },
          data: { fecha_notificacion: null },
        });
      }

      const pagina1 = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/espera?perPage=2&page=1`)
        .expect(200);
      const pagina2 = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/espera?perPage=2&page=2`)
        .expect(200);

      expect(pagina1.body).toHaveLength(2);
      expect(pagina2.body).toHaveLength(2);

      const ids = [...pagina1.body, ...pagina2.body].map((e: { id: number }) => e.id);
      expect(new Set(ids).size).toBe(CANTIDAD);

      // Orden total y estable: por anotación y, ante empate, por id ascendente.
      expect(ids).toEqual([...ids].sort((a: number, b: number) => a - b));

      const listadoCompleto = await request(app.getHttpServer())
        .get(`/api/v1/clases/${claseId}/espera`)
        .expect(200);
      const idsCompleto = listadoCompleto.body.map((e: { id: number }) => e.id);
      expect(idsCompleto).toEqual(ids);
    });

    it('GET /esperas-clases filtra por clase, socio y estado', async () => {
      const fechaClase = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
          tipo: 'Listado Global Espera',
          instructor: 'Profe Global Espera',
          horario: fechaClase,
          capacidad: 1,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      const socioOcupante = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      const socioB = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: socioOcupante.socioId })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/espera`)
        .send({ socioId: socioB.socioId })
        .expect(201);

      const resPorClase = await request(app.getHttpServer())
        .get(`/api/v1/esperas-clases?claseId=${claseId}`)
        .expect(200);
      expect(resPorClase.body).toHaveLength(1);
      expect(resPorClase.body[0].claseId).toBe(claseId);

      const resPorSocio = await request(app.getHttpServer())
        .get(`/api/v1/esperas-clases?socioId=${socioB.socioId}`)
        .expect(200);
      expect(resPorSocio.body).toHaveLength(1);
      expect(resPorSocio.body[0].socioId).toBe(socioB.socioId);

      const resPorEstado = await request(app.getHttpServer())
        .get(`/api/v1/esperas-clases?claseId=${claseId}&estado=EN_ESPERA`)
        .expect(200);
      expect(resPorEstado.body).toHaveLength(1);

      const resOtroEstado = await request(app.getHttpServer())
        .get(`/api/v1/esperas-clases?claseId=${claseId}&estado=CANCELADO`)
        .expect(200);
      expect(resOtroEstado.body).toHaveLength(0);

      await request(app.getHttpServer())
        .get(`/api/v1/esperas-clases?estado=INVALIDO`)
        .expect(422);
    });

    it('GET /clases pagina los resultados y ya no acepta el filtro fecha', async () => {
      for (const horas of [24, 25, 26]) {
        const resClase = await request(app.getHttpServer())
          .post('/api/v1/clases')
          .send({
            sedeId: sedeId,
            tipo: 'Demo Paginacion',
            instructor: 'Profe Paginacion',
            horario: new Date(Date.now() + horas * 3600 * 1000).toISOString(),
            capacidad: 5,
          })
          .expect(201);
        clasesCreadas.push(resClase.body.id);
      }

      const resPagina1 = await request(app.getHttpServer())
        .get('/api/v1/clases?tipo=Demo Paginacion&perPage=2&page=1')
        .expect(200);
      expect(resPagina1.body).toHaveLength(2);

      const resPagina2 = await request(app.getHttpServer())
        .get('/api/v1/clases?tipo=Demo Paginacion&perPage=2&page=2')
        .expect(200);
      expect(resPagina2.body).toHaveLength(1);

      const resPagina3 = await request(app.getHttpServer())
        .get('/api/v1/clases?tipo=Demo Paginacion&perPage=2&page=3')
        .expect(200);
      expect(resPagina3.body).toHaveLength(0);

      const resTodas = await request(app.getHttpServer())
        .get('/api/v1/clases?tipo=Demo Paginacion&perPage=100')
        .expect(200);
      expect(resTodas.body).toHaveLength(3);

      await request(app.getHttpServer())
        .get('/api/v1/clases?fecha=2026-10-15')
        .expect(422);

      await request(app.getHttpServer())
        .get('/api/v1/clases?perPage=0')
        .expect(422);

      await request(app.getHttpServer())
        .get('/api/v1/clases?perPage=101')
        .expect(422);
    });
  });

  describe('Concurrencia Pesimista (Stress Test)', () => {
    it('10 intentos simultáneos para el último cupo: solo 1 tiene éxito y 9 reciben 409', async () => {
      // Creamos una clase con capacidad para exactamente 1 persona
      const fechaClase = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
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
            .post('/api/v1/reservas-clases')
            .send({ claseId: claseId, socioId: s.socioId }),
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

    it('anotaciones repetidas del mismo socio dejan una sola espera activa y las otras reciben 409', async () => {
      // El findFirst de crear() corre antes del INSERT y sin lock, asi que dos
      // peticiones simultaneas del mismo socio pueden pasar ambas el chequeo.
      // Acá se fuerza ese hueco de forma determinista: se inserta la segunda
      // espera por Prisma saltando el chequeo de application, que es
      // exactamente lo que haria la peticion que gano la carrera. Lo decide el
      // indice parcial unico unq_espera_clase_socio_activa, y el P2002 sale
      // como 409 por el service.
      //
      // No se prueba con N requests en paralelo porque la carrera no se
      // reproduce en forma fiable: el findFirst suele alcanzar a atrapar el
      // segundo POST y el test pasaria aunque la constraint no existiera.
      const fechaClase = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
          tipo: 'Espera Simultanea',
          instructor: 'Profe Espera Simultanea',
          horario: fechaClase,
          capacidad: 1,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      const ocupante = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: ocupante.socioId })
        .expect(201);

      const socio = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

      const resAlta = await request(app.getHttpServer())
        .post(`/api/v1/clases/${claseId}/espera`)
        .send({ socioId: socio.socioId })
        .expect(201);

      // Segundo INSERT del mismo par activo, sin pasar por crear().
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

      // Y por la API, una anotacion mas del mismo socio sigue siendo 409.
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
      // El indice parcial solo cubre EN_ESPERA y NOTIFICADO: CANCELADO queda
      // fuera, asi que la reinscripcion tiene que seguir siendo posible.
      const fechaClase = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      const resClase = await request(app.getHttpServer())
        .post('/api/v1/clases')
        .send({
          sedeId: sedeId,
          tipo: 'Reinscripcion Espera',
          instructor: 'Profe Reinscripcion',
          horario: fechaClase,
          capacidad: 1,
        })
        .expect(201);

      const claseId: number = resClase.body.id;
      clasesCreadas.push(claseId);

      const ocupante = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });
      await request(app.getHttpServer())
        .post('/api/v1/reservas-clases')
        .send({ claseId: claseId, socioId: ocupante.socioId })
        .expect(201);

      const socio = await crearSocioConMembresia({ vigente: true, sedeOrigenId: sedeId });

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
});
