import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemFilter } from '../src/commons/filters/problem.filter';
import { PrismaService } from '../src/commons/database/prisma.service';

// Flujo completo de M1: crear usuario -> hacerse socio con plan -> consultar
// membresia -> dejar de ser socio (vuelve a EXTERNO). Corre contra la base
// de test levantada con docker-compose.test.yml (ver docs/TESTING.md).
//
// Nota: M1 no tiene endpoint propio para crear Sede (eso vive en M2, que
// todavia no esta implementado), asi que la sede necesaria para
// CrearSocioDto.sede_origen_id se inserta directo con Prisma en
// beforeAll, no via HTTP.

describe('M1 - Usuarios / Socios / Membresias (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sedeId: number;

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
        nombre: 'Sede Test E2E',
        direccion: 'Calle Falsa 123',
        aforo_maximo: 50,
      },
    });
    sedeId = sede.id;
  });

  afterAll(async () => {
    // Limpieza en orden inverso a las FKs (membresia -> socio -> usuario -> sede).
    //
    // Acotada a los datos de ESTA suite. Antes era `deleteMany({})` a secas sobre
    // membresia y socio, que borra la base entera: con las tres suites sobre la misma
    // base, una podia borrar los fixtures de otra a mitad de run. Se filtra por el
    // prefijo de email de M1 (`socio.`), que es unico; M2 usa `m2.` y M3 usa `m3.`.
    const mio = { usuario: { email: { startsWith: 'socio.' } } };
    await prisma.membresia.deleteMany({ where: { socio: mio } });
    await prisma.socio.deleteMany({ where: mio });
    await prisma.usuario.deleteMany({ where: { email: { startsWith: 'socio.' } } });
    await prisma.sede.delete({ where: { id: sedeId } });
    await app.close();
  });

  const emailUnico = () => `socio.${Date.now()}.${Math.floor(Math.random() * 1000)}@e2e.fitzone.test`;
  const dniUnico = () => String(10000000 + Math.floor(Math.random() * 89999999));

  it('flujo completo: usuario -> socio -> membresia -> baja', async () => {
    const emailDelSocio = emailUnico();

    // 1) POST /usuarios
    const crearUsuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Socio E2E',
        email: emailDelSocio,
        contrasenia: 'clave12345',
      })
      .expect(201);

    expect(crearUsuarioRes.body.contrasenia).toBeUndefined();
    const usuarioId: number = crearUsuarioRes.body.id;
    expect(typeof usuarioId).toBe('number');

    // 2) POST /socios con plan -> crea socio + membresia en la misma transaccion
    const crearSocioRes = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({
        usuario_id: usuarioId,
        sede_origen_id: sedeId,
        plan: 'MENSUAL',
      })
      .expect(201);

    const socioId: number = crearSocioRes.body.id;
    expect(crearSocioRes.body.usuario_id).toBe(usuarioId);

    // SocioOut expone nombre/email, tomados del Usuario relacionado. El contrato
    // los marca required, asi que tienen que venir en el POST, no solo en el GET.
    expect(crearSocioRes.body.nombre).toBe('Socio E2E');
    expect(crearSocioRes.body.email).toBe(emailDelSocio);

    // El usuario ahora es SOCIO
    const usuarioComoSocio = await request(app.getHttpServer())
      .get(`/api/v1/usuarios/${usuarioId}`)
      .expect(200);
    expect(usuarioComoSocio.body.rol).toBe('SOCIO');

    // GET /socios/{id}: mismo shape, con nombre/email
    const socioObtenido = await request(app.getHttpServer())
      .get(`/api/v1/socios/${socioId}`)
      .expect(200);
    expect(socioObtenido.body.nombre).toBe('Socio E2E');
    expect(socioObtenido.body.email).toBe(emailDelSocio);

    // PATCH /socios/{id}: los sigue exponiendo (mismo camino de actualizar)
    const socioPatched = await request(app.getHttpServer())
      .patch(`/api/v1/socios/${socioId}`)
      .send({ sede_origen_id: sedeId })
      .expect(200);
    expect(socioPatched.body.nombre).toBe('Socio E2E');
    expect(socioPatched.body.email).toBe(emailDelSocio);

    // 3) GET /socios/{socioId}/membresias -> fecha_fin = fecha_inicio + 1 mes
    const membresiaRes = await request(app.getHttpServer())
      .get(`/api/v1/socios/${socioId}/membresias`)
      .expect(200);

    expect(membresiaRes.body.plan).toBe('MENSUAL');
    const inicio = new Date(membresiaRes.body.fecha_inicio);
    const fin = new Date(membresiaRes.body.fecha_fin);
    const esperado = new Date(inicio);
    esperado.setMonth(esperado.getMonth() + 1);
    expect(fin.toISOString().slice(0, 10)).toBe(esperado.toISOString().slice(0, 10));

    // 4) DELETE /socios/{socioId} -> 204, usuario vuelve a EXTERNO
    await request(app.getHttpServer())
      .delete(`/api/v1/socios/${socioId}`)
      .expect(204);

    const usuarioFinal = await request(app.getHttpServer())
      .get(`/api/v1/usuarios/${usuarioId}`)
      .expect(200);
    expect(usuarioFinal.body.rol).toBe('EXTERNO');

    await request(app.getHttpServer())
      .get(`/api/v1/socios/${socioId}/membresias`)
      .expect(404);
  });

  it('GET /usuarios: listado plano, filtros y lista blanca', async () => {
    const emailAna = emailUnico();
    await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Ana Gómez',
        email: emailAna,
        contrasenia: 'clave12345',
      })
      .expect(201);

    // Sin filtros devuelve un array plano, no un objeto paginado. No se puede
    // afirmar length: la base puede traer datos de otros tests y el default de
    // per_page es 20, asi que se busca al usuario dentro del array.
    //
    // per_page=100 explicito: con el default 20, los fixtures de este spec se
    // caian fuera de la pagina cuando otra suite agrega usuarios en paralelo
    // (vitest corre los archivos concurrentemente contra la misma base).
    const todos = await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .query({ per_page: 100 })
      .expect(200);
    expect(Array.isArray(todos.body)).toBe(true);
    const ana = todos.body.find((u) => u.email === emailAna);
    expect(ana).toBeDefined();
    expect(ana.contrasenia).toBeUndefined();

    // nombre parcial sin distinguir mayusculas: 'ana' tiene que encontrar 'Ana Gómez'
    const porNombre = await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .query({ nombre: 'ana' })
      .expect(200);
    expect(porNombre.body.map((u) => u.email)).toContain(emailAna);

    // email exacto (es @unique, asi que el resultado es exactamente uno)
    const porEmail = await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .query({ email: emailAna })
      .expect(200);
    expect(porEmail.body).toHaveLength(1);
    expect(porEmail.body[0].email).toBe(emailAna);

    // coincidencia negativa -> array vacio, no 404
    const sinNada = await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .query({ nombre: 'zzz-no-existe-zzz' })
      .expect(200);
    expect(sinNada.body).toHaveLength(0);

    // filtro por rol
    const gerentes = await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .query({ rol: 'GERENTE' })
      .expect(200);
    expect(gerentes.body.every((u) => u.rol === 'GERENTE')).toBe(true);

    // paginacion. Ademas de acotar la pagina, prueba que el @Type(() => Number)
    // convierte: si per_page quedara como string, @IsInt() responderia 422.
    const primeraPagina = await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .query({ page: 1, per_page: 1 })
      .expect(200);
    expect(primeraPagina.body).toHaveLength(1);

    // lista blanca: parametro fuera del contrato -> 422
    await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .query({ parametroInvalido: 'x' })
      .expect(422);

    // rol fuera del enum -> 422
    await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .query({ rol: 'INVENTADO' })
      .expect(422);
  });

  it('GET /socios: listado, filtros sobre relaciones y lista blanca', async () => {
    // Socio CON membresia ACTIVA/MENSUAL.
    const emailCarlos = emailUnico();
    const usuarioCarlos = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Carlos Gomez',
        email: emailCarlos,
        contrasenia: 'clave12345',
      })
      .expect(201);
    const socioConMembresia = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioCarlos.body.id, sede_origen_id: sedeId, plan: 'MENSUAL' })
      .expect(201);

    // Socio SIN membresia (plan es opcional): sirve para probar que los filtros
    // de membresia lo excluyen, ya que la relacion es opcional en el schema.
    const emailZoe = emailUnico();
    const usuarioZoe = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Zoe Diaz',
        email: emailZoe,
        contrasenia: 'clave12345',
      })
      .expect(201);
    const socioSinMembresia = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioZoe.body.id, sede_origen_id: sedeId })
      .expect(201);

    const idCon = socioConMembresia.body.id;
    const idSin = socioSinMembresia.body.id;

    // Sin filtros: array plano, y trae nombre/email (contrato, Paso 1).
    const todos = await request(app.getHttpServer()).get('/api/v1/socios').expect(200);
    expect(Array.isArray(todos.body)).toBe(true);
    const encontrado = todos.body.find((s) => s.id === idCon);
    expect(encontrado).toBeDefined();
    expect(encontrado.nombre).toBe('Carlos Gomez');
    expect(encontrado.email).toBe(emailCarlos);

    // Filtro por sede de origen (columna, no relacion)
    const porSede = await request(app.getHttpServer())
      .get('/api/v1/socios')
      .query({ sede_origen_id: sedeId })
      .expect(200);
    expect(porSede.body.map((s) => s.id)).toContain(idCon);

    const otraSede = await request(app.getHttpServer())
      .get('/api/v1/socios')
      .query({ sede_origen_id: sedeId + 9999 })
      .expect(200);
    expect(otraSede.body).toHaveLength(0);

    // Los filtros de membresia cruzan la relacion 1:1
    const porEstado = await request(app.getHttpServer())
      .get('/api/v1/socios')
      .query({ estado_membresia: 'ACTIVA' })
      .expect(200);
    expect(porEstado.body.map((s) => s.id)).toContain(idCon);

    const porPlan = await request(app.getHttpServer())
      .get('/api/v1/socios')
      .query({ plan: 'MENSUAL' })
      .expect(200);
    expect(porPlan.body.map((s) => s.id)).toContain(idCon);

    // estado + plan se ANDean sobre la MISMA relacion
    const combinado = await request(app.getHttpServer())
      .get('/api/v1/socios')
      .query({ estado_membresia: 'ACTIVA', plan: 'MENSUAL' })
      .expect(200);
    expect(combinado.body.map((s) => s.id)).toContain(idCon);

    // Contradiccion: la membresia es MENSUAL, no ANUAL
    const porPlanAnual = await request(app.getHttpServer())
      .get('/api/v1/socios')
      .query({ plan: 'ANUAL' })
      .expect(200);
    expect(porPlanAnual.body.map((s) => s.id)).not.toContain(idCon);

    // `membresia` es opcional: un filtro de membresia excluye al socio que no
    // tiene ninguna. Es la semantica correcta, no un dato sin revisar.
    expect(porPlan.body.map((s) => s.id)).not.toContain(idSin);
    expect(porEstado.body.map((s) => s.id)).not.toContain(idSin);
    // Sin filtro de membresia si tiene que aparecer.
    expect(todos.body.map((s) => s.id)).toContain(idSin);

    // nombre parcial sin distinguir mayusculas: 'carlos' -> 'Carlos Gomez'
    const porNombre = await request(app.getHttpServer())
      .get('/api/v1/socios')
      .query({ nombre: 'carlos' })
      .expect(200);
    expect(porNombre.body.map((s) => s.id)).toContain(idCon);
    expect(porNombre.body.map((s) => s.id)).not.toContain(idSin);

    // lista blanca + enums invalidos -> 422
    await request(app.getHttpServer())
      .get('/api/v1/socios')
      .query({ parametroInvalido: 'x' })
      .expect(422);
    await request(app.getHttpServer())
      .get('/api/v1/socios')
      .query({ plan: 'INVENTADO' })
      .expect(422);
    await request(app.getHttpServer())
      .get('/api/v1/socios')
      .query({ estado_membresia: 'INVENTADO' })
      .expect(422);
  });

  it('POST /socios responde 404 si usuario_id no existe', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: 999999, sede_origen_id: sedeId })
      .expect(404);
  });

  it('PATCH /usuarios/{id} acepta null para limpiar telefono y foto_url', async () => {
    // El contrato declara telefono y foto_url como nullable en UsuarioPatch, asi
    // que mandarlos en null tiene que persistir el borrado y no un 422. El tipo
    // del DTO era `string | undefined`, que no permitia el null que el contrato
    // promete; y modificar() compara con `!== undefined`, no con falsy, asi que
    // un null llega a Prisma. Este test fija las dos partes.
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Patch Null E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
        telefono: '+54 351 555-0000',
        foto_url: 'https://cdn.fitzone.com.ar/fotos/patch.jpg',
      })
      .expect(201);
    const usuarioId = usuarioRes.body.id;
    expect(usuarioRes.body.telefono).toBe('+54 351 555-0000');
    expect(usuarioRes.body.foto_url).toBe('https://cdn.fitzone.com.ar/fotos/patch.jpg');

    const limpiado = await request(app.getHttpServer())
      .patch(`/api/v1/usuarios/${usuarioId}`)
      .send({ telefono: null, foto_url: null })
      .expect(200);

    expect(limpiado.body.telefono).toBeNull();
    expect(limpiado.body.foto_url).toBeNull();

    // Y el GET confirma que quedo en la base, no solo en la respuesta del PATCH.
    const despues = await request(app.getHttpServer())
      .get(`/api/v1/usuarios/${usuarioId}`)
      .expect(200);
    expect(despues.body.telefono).toBeNull();
    expect(despues.body.foto_url).toBeNull();
  });

  it('POST /socios responde 409 si el usuario ya es socio', async () => {
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Ya Socio E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
      })
      .expect(201);
    const usuarioId = usuarioRes.body.id;

    await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioId, sede_origen_id: sedeId })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioId, sede_origen_id: sedeId })
      .expect(409);
  });

  it('POST /socios/{id}/membresias responde 409 si el socio ya tiene membresia', async () => {
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Doble Membresia E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
      })
      .expect(201);

    const socioRes = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({
        usuario_id: usuarioRes.body.id,
        sede_origen_id: sedeId,
        plan: 'MENSUAL',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/socios/${socioRes.body.id}/membresias`)
      .send({ plan: 'ANUAL' })
      .expect(409);
  });
});
