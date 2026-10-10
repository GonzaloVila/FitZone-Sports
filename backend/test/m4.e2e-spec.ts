import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/commons/database/prisma.service';
import { ProblemFilter } from '../src/commons/filters/problem.filter';
import { PRECIOS_PLAN } from '../src/modules/m1-usuarios/entities/membresia.entity';

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
  // usuarioId -> Usuario, y la membresia se consulta por el socio del usuario.
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
        precio: PRECIOS_PLAN.MENSUAL,
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

  // Bloque 4 (QA). Los endpoints de canchas no tenian cobertura propia: las
  // canchas que usan los tests de reservas se crean directo por Prisma, y el
  // unico PATCH aparecia de paso al probar el mantenimiento. Este bloque los
  // ejercita por HTTP y fija el contrato de los cuatro.
  describe('RF-09 - canchas: alta, listado, consulta y modificacion', () => {
    let sedeCanchasId: number;

    beforeAll(async () => {
      const sede = await prisma.sede.create({
        data: { nombre: 'Sede E2E M4 canchas', direccion: 'Calle Sin Nombre 789', aforo_maximo: 30 },
      });
      sedeCanchasId = sede.id;
      sedesCreadas.push(sede.id);
    });

    // Crea la cancha por HTTP (no por Prisma) y la registra para el afterAll.
    async function crearCancha(dto: Record<string, unknown>) {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/sedes/${sedeCanchasId}/canchas`)
        .send(dto)
        .expect(201);
      canchasCreadas.push(res.body.id);
      return res.body as { id: number; sedeId: number; tipo: string; costoPorHora: number; estado: string };
    }

    async function crearExterno(): Promise<number> {
      const usuario = await prisma.usuario.create({
        data: {
          rol: 'EXTERNO',
          dni: dniUnico(),
          nombre: 'Externo E2E M4 canchas',
          email: emailUnico(),
          contrasenia: 'hash-no-relevante',
        },
      });
      usuariosCreados.push(usuario.id);
      return usuario.id;
    }

    it('crea una cancha, devuelve 201 con Location y deja el estado en OPERATIVA', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/sedes/${sedeCanchasId}/canchas`)
        .send({ tipo: 'PADDLE', costoPorHora: 7000 })
        .expect(201);
      canchasCreadas.push(res.body.id);

      expect(res.headers.location).toBe(`/api/v1/sedes/${sedeCanchasId}/canchas/${res.body.id}`);
      expect(res.body.sedeId).toBe(sedeCanchasId);
      expect(res.body.tipo).toBe('PADDLE');
      expect(res.body.costoPorHora).toBe(7000);
      // Sin `estado` en el body: el default del service, no del DTO.
      expect(res.body.estado).toBe('OPERATIVA');
    });

    it('devuelve costo_por_hora como numero JSON y no como string', async () => {
      // Decimal con decimales: si el repository no hiciera toNumber() el body
      // saldria como "7250.50" y el contrato declara number.
      const cancha = await crearCancha({ tipo: 'FUTBOL5', costoPorHora: 7250.5 });

      expect(typeof cancha.costoPorHora).toBe('number');
      expect(cancha.costoPorHora).toBeCloseTo(7250.5, 2);
    });

    it('responde 404 si la sede no existe, con el detail propio del listado', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sedes/99999999/canchas')
        .send({ tipo: 'PADDLE', costoPorHora: 5000 })
        .expect(404);

      expect(res.headers['content-type']).toContain('application/problem+json');
      // No es el "No existe el recurso solicitado para el id indicado." genérico
      // de obtenerCancha/modificarCancha: acá se nombró la sede.
      expect(res.body.detail).toBe('No existe la sede indicada.');
    });

    it('responde 422 si tipo, costo_por_hora o estado no son validos', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/sedes/${sedeCanchasId}/canchas`)
        .send({ tipo: 'TENIS', costoPorHora: 5000 })
        .expect(422);

      await request(app.getHttpServer())
        .post(`/api/v1/sedes/${sedeCanchasId}/canchas`)
        .send({ tipo: 'PADDLE', costoPorHora: -1 })
        .expect(422);

      await request(app.getHttpServer())
        .post(`/api/v1/sedes/${sedeCanchasId}/canchas`)
        .send({ tipo: 'PADDLE', costoPorHora: 5000, estado: 'ROTA' })
        .expect(422);

      // Sin tipo ni costo: ambos son obligatorios.
      await request(app.getHttpServer())
        .post(`/api/v1/sedes/${sedeCanchasId}/canchas`)
        .send({})
        .expect(422);
    });

    it('responde 422 si el body trae un campo desconocido', async () => {
      // forbidNonWhitelisted: sedeId y tipo_no_existe no pertenecen al DTO.
      const res = await request(app.getHttpServer())
        .post(`/api/v1/sedes/${sedeCanchasId}/canchas`)
        .send({ tipo: 'PADDLE', costoPorHora: 5000, sedeId: 1, tipo_no_existe: true })
        .expect(422);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.status).toBe(422);
    });

    it('lista sin ?estado= devuelve tambien las canchas en mantenimiento', async () => {
      await crearCancha({ tipo: 'PADDLE', costoPorHora: 5000 });
      await crearCancha({ tipo: 'FUTBOL5', costoPorHora: 5000 });
      await crearCancha({ tipo: 'PADDLE', costoPorHora: 5000, estado: 'EN_MANTENIMIENTO' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeCanchasId}/canchas?perPage=100`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(3);
      // RF-12: el listado NO esconde las no operativas, a diferencia del listado
      // de reservas que solo muestra CONFIRMADA.
      expect(res.body.filter((c: { estado: string }) => c.estado === 'EN_MANTENIMIENTO').length).toBeGreaterThan(0);
      expect(res.body.filter((c: { estado: string }) => c.estado === 'OPERATIVA').length).toBeGreaterThanOrEqual(2);
      expect(res.body.every((c: { sedeId: number }) => c.sedeId === sedeCanchasId)).toBe(true);
    });

    it('filtra el listado por ?estado=', async () => {
      await crearCancha({ tipo: 'PADDLE', costoPorHora: 5000 });
      await crearCancha({ tipo: 'PADDLE', costoPorHora: 5000, estado: 'EN_MANTENIMIENTO' });

      const todas = await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeCanchasId}/canchas?perPage=100`)
        .expect(200);
      const operativas = await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeCanchasId}/canchas?estado=OPERATIVA&perPage=100`)
        .expect(200);
      const mantenimiento = await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeCanchasId}/canchas?estado=EN_MANTENIMIENTO&perPage=100`)
        .expect(200);

      expect(operativas.body.length).toBeGreaterThan(0);
      expect(operativas.body.every((c: { estado: string }) => c.estado === 'OPERATIVA')).toBe(true);
      expect(mantenimiento.body.length).toBeGreaterThan(0);
      expect(mantenimiento.body.every((c: { estado: string }) => c.estado === 'EN_MANTENIMIENTO')).toBe(true);
      // Los dos filtros juntos cubren el listado completo: nadie se pierde.
      expect(operativas.body.length + mantenimiento.body.length).toBe(todas.body.length);
    });

    it('pagina con page y per_page, y devuelve vacio mas alla del total', async () => {
      for (let i = 0; i < 3; i += 1) {
        await crearCancha({ tipo: 'PADDLE', costoPorHora: 5000 + i });
      }

      // Baseline: el listado completo de la sede, que es el orden de referencia.
      const todas = await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeCanchasId}/canchas?perPage=100`)
        .expect(200);
      expect(todas.body.length).toBeGreaterThanOrEqual(3);

      const pagina1 = await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeCanchasId}/canchas?page=1&perPage=2`)
        .expect(200);
      const pagina2 = await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeCanchasId}/canchas?page=2&perPage=2`)
        .expect(200);

      expect(pagina1.body.length).toBe(2);
      expect(pagina2.body.length).toBe(2);
      // skip/take con orderBy id asc: la segunda pagina sigue a la primera sin
      // repetir ni saltar canchas.
      expect(pagina1.body.map((c: { id: number }) => c.id)).toEqual(todas.body.slice(0, 2).map((c: { id: number }) => c.id));
      expect(pagina2.body.map((c: { id: number }) => c.id)).toEqual(todas.body.slice(2, 4).map((c: { id: number }) => c.id));

      // perPage=100 es el maximo declarado; con esa pagina el total esta lejos.
      const vacia = await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeCanchasId}/canchas?page=99&perPage=100`)
        .expect(200);
      expect(Array.isArray(vacia.body)).toBe(true);
      expect(vacia.body.length).toBe(0);
    });

    it('responde 422 si el filtro o la paginacion son invalidos', async () => {
      // El DTO del listado valida con @IsIn/@Min/@Max y la ValidationPipe global
      // corre sobre los query params igual que sobre los bodies.
      await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeCanchasId}/canchas?estado=INVALIDA`)
        .expect(422);

      await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeCanchasId}/canchas?page=0`)
        .expect(422);

      // perPage=101 excede el @Max(100) del DTO y del contrato.
      await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeCanchasId}/canchas?perPage=101`)
        .expect(422);

      // forbidNonWhitelisted tambien aplica a los query params.
      const desconocido = await request(app.getHttpServer())
        .get(`/api/v1/sedes/${sedeCanchasId}/canchas?parametro=futuro`)
        .expect(422);
      expect(desconocido.headers['content-type']).toContain('application/problem+json');
    });

    it('responde 404 en el listado si la sede no existe', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/sedes/99999999/canchas').expect(404);
      expect(res.body.detail).toBe('No existe la sede indicada.');
    });

    it('obtiene una cancha por id con todos sus campos', async () => {
      const creada = await crearCancha({ tipo: 'FUTBOL5', costoPorHora: 6400 });

      const res = await request(app.getHttpServer()).get(`/api/v1/canchas/${creada.id}`).expect(200);

      expect(res.body).toEqual({
        id: creada.id,
        sedeId: sedeCanchasId,
        tipo: 'FUTBOL5',
        costoPorHora: 6400,
        estado: 'OPERATIVA',
      });
    });

    it('responde 404 al obtener una cancha inexistente', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/canchas/99999999').expect(404);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.detail).toBe('No existe el recurso solicitado para el id indicado.');
    });

    it('modifica solo costo_por_hora y deja el estado intacto', async () => {
      const cancha = await crearCancha({ tipo: 'PADDLE', costoPorHora: 5000 });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/canchas/${cancha.id}`)
        .send({ costoPorHora: 5500 })
        .expect(200);

      expect(res.body.costoPorHora).toBe(5500);
      expect(res.body.estado).toBe('OPERATIVA');
      expect(res.body.tipo).toBe('PADDLE');

      // Y el cambio quedo persistido, no solo en la respuesta.
      const consulta = await request(app.getHttpServer()).get(`/api/v1/canchas/${cancha.id}`).expect(200);
      expect(consulta.body.costoPorHora).toBe(5500);
    });

    it('modifica solo estado y deja el costo intacto', async () => {
      const cancha = await crearCancha({ tipo: 'PADDLE', costoPorHora: 5000 });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/canchas/${cancha.id}`)
        .send({ estado: 'EN_MANTENIMIENTO' })
        .expect(200);

      expect(res.body.estado).toBe('EN_MANTENIMIENTO');
      expect(res.body.costoPorHora).toBe(5000);

      const consulta = await request(app.getHttpServer()).get(`/api/v1/canchas/${cancha.id}`).expect(200);
      expect(consulta.body.costoPorHora).toBe(5000);
      expect(consulta.body.estado).toBe('EN_MANTENIMIENTO');
    });

    it('responde 422 y no 500 con el body vacio en el PATCH', async () => {
      const cancha = await crearCancha({ tipo: 'PADDLE', costoPorHora: 5000 });

      // Sin @IsNotEmptyObject() los dos campos son opcionales, {} pasaba la
      // validacion y el repository armaba data: {} para Prisma. Eso no es
      // P2025, escapaba del catch y terminaba en 500.
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/canchas/${cancha.id}`)
        .send({})
        .expect(422);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.status).toBe(422);

      // Un 422 por body vacio no debe haber tocado la fila.
      const consulta = await request(app.getHttpServer()).get(`/api/v1/canchas/${cancha.id}`).expect(200);
      expect(consulta.body.costoPorHora).toBe(5000);
      expect(consulta.body.estado).toBe('OPERATIVA');
    });

    it('responde 404 y 422 en el PATCH segun el caso', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/canchas/99999999')
        .send({ costoPorHora: 5000 })
        .expect(404);

      const cancha = await crearCancha({ tipo: 'PADDLE', costoPorHora: 5000 });

      await request(app.getHttpServer())
        .patch(`/api/v1/canchas/${cancha.id}`)
        .send({ costoPorHora: -1 })
        .expect(422);

      await request(app.getHttpServer())
        .patch(`/api/v1/canchas/${cancha.id}`)
        .send({ estado: 'ROTA' })
        .expect(422);

      // tipo no es actualizable: forbidNonWhitelisted lo rechaza.
      await request(app.getHttpServer())
        .patch(`/api/v1/canchas/${cancha.id}`)
        .send({ tipo: 'FUTBOL5' })
        .expect(422);
    });

    it('una cancha creada por el endpoint ya esta disponible para reservar', async () => {
      // RNF-04: la sede nueva no se habilita sola, pero la cancha recien creada
      // tiene que poder reservarse de inmediato.
      const cancha = await crearCancha({ tipo: 'PADDLE', costoPorHora: 5000 });
      const externoId = await crearExterno();

      const res = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          canchaId: cancha.id,
          usuarioId: externoId,
          fechaHoraInicio: inicio('08:00'),
          fechaHoraFin: fin('09:00'),
        })
        .expect(201);

      expect(res.body.canchaId).toBe(cancha.id);
      expect(res.body.estado).toBe('CONFIRMADA');
    });

    it('PATCH a EN_MANTENIMIENTO hace fallar la reserva con 409 de mantenimiento', async () => {
      // El 409 de mantenimiento ya estaba cubierto metiendo la cancha en
      // mantenimiento por Prisma; aca se llega por el endpoint, que es lo que
      // conecta RF-09 con RF-12.
      const cancha = await crearCancha({ tipo: 'PADDLE', costoPorHora: 5000 });
      const externoId = await crearExterno();

      await request(app.getHttpServer())
        .patch(`/api/v1/canchas/${cancha.id}`)
        .send({ estado: 'EN_MANTENIMIENTO' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          canchaId: cancha.id,
          usuarioId: externoId,
          fechaHoraInicio: inicio('09:00'),
          fechaHoraFin: fin('10:00'),
        })
        .expect(409);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.type).toBe('https://fitzone.app/errores/cancha-en-mantenimiento');
      expect(res.body.status).toBe(409);
      // En mantenimiento no hubo concurrencia: el detalle del turno ocupado
      // seria falso y el test lo diferencia del otro 409.
      expect(res.body.detail).toContain('mantenimiento');
      expect(res.body.detail).not.toContain('Otro usuario');
    });
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
          canchaId: canchaId,
          usuarioId: externo.id,
          fechaHoraInicio: inicio('10:00'),
          fechaHoraFin: fin('11:00'),
        })
        .expect(201);

      expect(res.headers.location).toBe(`/api/v1/reservas-canchas/${res.body.id}`);
      expect(res.body.estado).toBe('CONFIRMADA');
      // RN-03: sin membresia vigente se cotiza como externo (costo plano).
      expect(Number(res.body.precioAplicado)).toBeCloseTo(5000, 2);
      // El timestamp vuelve en UTC; se compara el instante, no el string.
      expect(new Date(res.body.fechaHoraInicio).toISOString()).toBe('2026-11-12T13:00:00.000Z');
    });

    it('aplica el descuento de socio con membresia vigente (RN-03)', async () => {
      const socioId = await crearSocio({ vigente: true });

      const res = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          canchaId: canchaId,
          usuarioId: socioId,
          fechaHoraInicio: inicio('12:00'),
          fechaHoraFin: fin('13:00'),
        })
        .expect(201);

      // 15% de descuento sobre 5000, sin pico (12:00-13:00 no entra en 19-21).
      expect(Number(res.body.precioAplicado)).toBeCloseTo(4250, 2);
    });

    it('cobra como externo a un socio con membresia vencida (RN-03)', async () => {
      const socioId = await crearSocio({ vigente: false });

      const res = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          canchaId: canchaId,
          usuarioId: socioId,
          fechaHoraInicio: inicio('14:00'),
          fechaHoraFin: fin('15:00'),
        })
        .expect(201);

      expect(Number(res.body.precioAplicado)).toBeCloseTo(5000, 2);
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
      // empieza 12:30: el unique parcial (canchaId, fechaHoraInicio) lo
      // dejaria pasar; exq_reserva_turno no.
      const res = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          canchaId: canchaId,
          usuarioId: externo.id,
          fechaHoraInicio: inicio('12:30'),
          fechaHoraFin: fin('13:30'),
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
          canchaId: canchaId,
          usuarioId: externo.id,
          fechaHoraInicio: inicio('13:00'),
          fechaHoraFin: fin('14:00'),
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
          canchaId: otra.id,
          usuarioId: externo.id,
          fechaHoraInicio: inicio('10:00'),
          fechaHoraFin: fin('11:00'),
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
          canchaId: 99999999,
          usuarioId: externo.id,
          fechaHoraInicio: inicio('16:00'),
          fechaHoraFin: fin('17:00'),
        })
        .expect(404);

      // Inicio posterior al fin: el contrato no lo cubre con 4xx, asi que el
      // service responde 422 de dominio.
      const invertido = await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          canchaId: canchaId,
          usuarioId: externo.id,
          fechaHoraInicio: inicio('18:00'),
          fechaHoraFin: fin('17:00'),
        })
        .expect(422);
      expect(invertido.body.status).toBe(422);

      // Sin zona horaria: la fecha queda ambigua segun donde corra el server.
      await request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          canchaId: canchaId,
          usuarioId: externo.id,
          fechaHoraInicio: '2026-11-12T19:00:00',
          fechaHoraFin: '2026-11-12T20:00:00',
        })
        .expect(422);
    });
  });

  describe('RF-12 - listar y obtener', () => {
    it('sin ?estado= devuelve solo CONFIRMADA y con ?estado=CANCELADA las canceladas', async () => {
      const soloConfirmada = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas?canchaId=${canchaId}`)
        .expect(200);

      expect(Array.isArray(soloConfirmada.body)).toBe(true);
      expect(soloConfirmada.body.length).toBeGreaterThan(0);
      expect(soloConfirmada.body.every((r: { estado: string }) => r.estado === 'CONFIRMADA')).toBe(true);

      // Se cancela una y tiene que reaparecer solo cuando se la pide explicitamente.
      await request(app.getHttpServer())
        .post(`/api/v1/reservas-canchas/${soloConfirmada.body[0].id}/cancelaciones`)
        .expect(204);

      const canceladas = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas?canchaId=${canchaId}&estado=CANCELADA`)
        .expect(200);
      expect(canceladas.body.some((r: { id: number }) => r.id === soloConfirmada.body[0].id)).toBe(true);

      const porDefecto = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas?canchaId=${canchaId}`)
        .expect(200);
      expect(porDefecto.body.some((r: { id: number }) => r.id === soloConfirmada.body[0].id)).toBe(false);
    });

    it('filtra por dia de la sede y pagina', async () => {
      const delDia = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas?canchaId=${canchaId}&fecha=${DIA}`)
        .expect(200);
      expect(delDia.body.length).toBeGreaterThan(0);
      // Todo lo devuelto arranca dentro del dia consultado.
      for (const r of delDia.body) {
        expect(new Date(r.fechaHoraInicio).toISOString().slice(0, 10)).toBe('2026-11-12');
      }

      const primera = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas?canchaId=${canchaId}&page=1&perPage=1`)
        .expect(200);
      expect(primera.body).toHaveLength(1);
    });

    it('GET por id devuelve la reserva y 404 si no existe', async () => {
      const creada = await request(app.getHttpServer())
        .get(`/api/v1/reservas-canchas?canchaId=${canchaId}&page=1&perPage=1`)
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
          canchaId: canchaId,
          usuarioId: externa.id,
          fechaHoraInicio: inicio('08:00'),
          fechaHoraFin: fin('09:00'),
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
          canchaId: canchaId,
          usuarioId: externa.id,
          fechaHoraInicio: inicio('09:00'),
          fechaHoraFin: fin('10:00'),
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
          canchaId: canchaId,
          usuarioId: uno.id,
          fechaHoraInicio: inicio('15:00'),
          fechaHoraFin: fin('16:00'),
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
          canchaId: canchaId,
          usuarioId: otro.id,
          fechaHoraInicio: inicio('15:00'),
          fechaHoraFin: fin('16:00'),
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
          canchaId: canchaId,
          usuarioId: usuario.id,
          fechaHoraInicio: inicio('17:00'),
          fechaHoraFin: fin('18:00'),
        })
        .expect(201);

      // 17:00 de la sede es 20:00Z.
      const tramo = (cuerpo: Array<{ fechaHoraInicio: string; disponible: boolean }>) =>
        cuerpo.find(
          (e) => new Date(e.fechaHoraInicio).toISOString() === '2026-11-12T20:00:00.000Z',
        );

      const conOcupada = await request(app.getHttpServer())
        .get(`/api/v1/canchas/${canchaId}/disponibilidad?fecha=${DIA}&perPage=100`)
        .expect(200);
      expect(tramo(conOcupada.body)?.disponible).toBe(false);

      // Al cancelar, el tramo vuelve a estar disponible: la grilla lee solo las
      // reservas vigentes (RF-12 conserva el histórico, no la ocupación).
      await request(app.getHttpServer())
        .post(`/api/v1/reservas-canchas/${creada.body.id}/cancelaciones`)
        .expect(204);

      const conLibre = await request(app.getHttpServer())
        .get(`/api/v1/canchas/${canchaId}/disponibilidad?fecha=${DIA}&perPage=100`)
        .expect(200);
      expect(tramo(conLibre.body)?.disponible).toBe(true);
    });

    it('devuelve el dia completo en orden y pagina sin repetir ni perder', async () => {
      const dia = await request(app.getHttpServer())
        .get(`/api/v1/canchas/${canchaId}/disponibilidad?fecha=${DIA}&perPage=100`)
        .expect(200);

      // Grilla de 08:00 a 22:00 en pasos de 60 minutos.
      expect(dia.body).toHaveLength(14);
      for (let i = 1; i < dia.body.length; i++) {
        expect(new Date(dia.body[i].fechaHoraInicio).getTime()).toBeGreaterThan(
          new Date(dia.body[i - 1].fechaHoraInicio).getTime(),
        );
      }

      const paginada = await request(app.getHttpServer())
        .get(`/api/v1/canchas/${canchaId}/disponibilidad?fecha=${DIA}&page=2&perPage=7`)
        .expect(200);
      expect(paginada.body).toHaveLength(7);
      expect(paginada.body[0].fechaHoraInicio).toBe(dia.body[7].fechaHoraInicio);
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
          canchaId: conReserva.id,
          usuarioId: usuario.id,
          fechaHoraInicio: inicio('11:00'),
          fechaHoraFin: fin('12:00'),
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/canchas/${conReserva.id}`)
        .send({ estado: 'EN_MANTENIMIENTO' })
        .expect(200);

      const grilla = await request(app.getHttpServer())
        .get(`/api/v1/canchas/${conReserva.id}/disponibilidad?fecha=${DIA}&perPage=100`)
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

// RF-11: el recargo de horario pico (19:00-21:00, hora de la sede) se aplica a la
// reserva que EMPIEZA dentro de la franja, y el socio tiene 15% de descuento sobre
// el precio estándar del externo. Las dos reglas se acumulan (0.85 x 1.20).
  it('RF-11: recargo pico por inicio de la reserva + descuento del socio (15%)', async () => {
    const picoDia = '2026-11-20';

    // Una cancha por reserva: así ningún turno comparte cancha/horario y RN-02 no
    // interfiere con lo que este test quiere medir (el precio).
    async function nuevaCancha(): Promise<number> {
      const c = await prisma.cancha.create({
        data: { sede_id: sedeId, tipo: 'FUTBOL5', costo_por_hora: 10000, estado: 'OPERATIVA' },
      });
      canchasCreadas.push(c.id);
      return c.id;
    }

    async function reservar(canchaId: number, usuarioId: number, desde: string, hasta: string) {
      return request(app.getHttpServer())
        .post('/api/v1/reservas-canchas')
        .send({
          canchaId,
          usuarioId,
          fechaHoraInicio: `${picoDia}T${desde}-03:00`,
          fechaHoraFin: `${picoDia}T${hasta}-03:00`,
        })
        .expect(201);
    }

    const externo = await prisma.usuario.create({
      data: {
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Externo Pico E2E',
        email: `m4pico.${Date.now()}.${Math.floor(Math.random() * 1000)}@e2e.fitzone.test`,
        contrasenia: 'hash-no-relevante',
      },
    });
    usuariosCreados.push(externo.id);
    const socioUserId = await crearSocio({ vigente: true });

    // La reserva EMPIEZA 20:00 local (dentro de [19:00,21:00)): externo con recargo.
    const pico = await reservar(await nuevaCancha(), externo.id, '20:00:00', '20:59:59');
    expect(pico.body.precioAplicado).toBe(12000);

    // Socio en pico: 15% off sobre el precio con recargo (10000 × 1.2 × 0.85).
    const socioPico = await reservar(await nuevaCancha(), socioUserId, '20:00:00', '20:59:59');
    expect(socioPico.body.precioAplicado).toBe(10200);

    // Fuera de pico: externo paga estándar y el socio 15% off.
    const normal = await reservar(await nuevaCancha(), externo.id, '14:00:00', '14:59:59');
    expect(normal.body.precioAplicado).toBe(10000);

    const socioNormal = await reservar(await nuevaCancha(), socioUserId, '14:00:00', '14:59:59');
    expect(socioNormal.body.precioAplicado).toBe(8500);

    // Arranca antes de la franja y termina dentro: NO es pico (cuenta el inicio).
    const terminaEnPico = await reservar(await nuevaCancha(), externo.id, '18:30:00', '19:30:00');
    expect(terminaEnPico.body.precioAplicado).toBe(10000);
  });
});
