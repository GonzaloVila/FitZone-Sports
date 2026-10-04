import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProblemFilter } from '../src/commons/filters/problem.filter';
import { PrismaService } from '../src/commons/database/prisma.service';
import { PRECIOS_PLAN } from '../src/modules/m1-usuarios/entities/membresia.entity';

// Flujo completo de M1: crear usuario -> hacerse socio con plan -> consultar
// membresia -> dejar de ser socio (vuelve a EXTERNO). Corre contra la base
// de test levantada con docker-compose.test.yml (ver docs/TESTING.md).
//
// Nota: M1 no tiene endpoint propio para crear Sede (eso vive en M2, que
// todavia no esta implementado), asi que la sede necesaria para
// SocioIn.sede_origen_id se inserta directo con Prisma en
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
    // Limpieza en orden inverso a las FKs (pago membresia -> pago -> membresia -> socio -> usuario -> sede).
    //
    // Acotada a los datos de ESTA suite. Antes era `deleteMany({})` a secas sobre
    // membresia y socio, que borra la base entera: con las tres suites sobre la misma
    // base, una podia borrar los fixtures de otra a mitad de run. Se filtra por el
    // prefijo de email de M1 (`socio.`), que es unico; M2 usa `m2.` y M3 usa `m3.`.
    // El alta ahora cobra la membresia (RF-02) y la baja conserva el Pago como
    // historial con PagoMembresia.membresia_id en NULL (migracion 20261004020000),
    // asi que los pagos se borran por el email del USUARIO, no por la membresia.
    const emailM1 = { email: { startsWith: 'socio.' } };
    const pagos = await prisma.pago.findMany({
      where: { usuario: emailM1 },
      select: { id: true },
    });
    const idsPagos = pagos.map((p) => p.id);
    await prisma.pagoMembresia.deleteMany({
      where: idsPagos.length > 0 ? { id_pago: { in: idsPagos } } : { id_pago: -1 },
    });
    if (idsPagos.length > 0) {
      await prisma.pago.deleteMany({ where: { id: { in: idsPagos } } });
    }
    const mio = { usuario: emailM1 };
    await prisma.membresia.deleteMany({ where: { socio: mio } });
    await prisma.socio.deleteMany({ where: mio });
    await prisma.usuario.deleteMany({ where: emailM1 });
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

  it('RF-02: el pago de la membresia sobrevive a la baja del socio (historial)', async () => {
    // Alta de socio: ahora cobra la membresia inicial en el mismo flujo (RF-02).
    const emailDelSocio = emailUnico();
    const crearUsuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Pago Historial',
        email: emailDelSocio,
        contrasenia: 'clave12345',
      })
      .expect(201);
    const usuarioId = crearUsuarioRes.body.id;

    const socio = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({
        usuario_id: usuarioId,
        sede_origen_id: sedeId,
        plan: 'MENSUAL',
      })
      .expect(201);

    // El alta genero un PagoMembresia APROBADO (cobro interno).
    const pagoAntes = await prisma.pago.findFirst({
      where: { usuario_id: usuarioId, pago_membresia: { isNot: null } },
      include: { pago_membresia: true },
    });
    expect(pagoAntes).not.toBeNull();
    const pagoId = pagoAntes!.id;

    // Baja del socio: 204, usuario vuelve a EXTERNO.
    await request(app.getHttpServer())
      .delete(`/api/v1/socios/${socio.body.id}`)
      .expect(204);

    // El Pago sigue existiendo (historial), con el enlace PagoMembresia desvinculado
    // (membresia_id NULL por la FK SetNull) y el comprobante con la identidad del socio.
    const pagoDespues = await prisma.pago.findUnique({
      where: { id: pagoId },
      include: { pago_membresia: true },
    });
    expect(pagoDespues).not.toBeNull();
    expect(pagoDespues!.pago_membresia?.membresia_id).toBeNull();

    // El comprobante del pago conservado sigue sirviendose (la identidad del socio
    // en el PDF se verifica en comprobantes.service.spec.ts).
    await request(app.getHttpServer())
      .get(`/api/v1/pagos/${pagoId}/comprobante`)
      .expect(200);
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

    // Socio con plan ANUAL: como no existe un socio sin membresia, la
    // exclusion de los filtros se prueba con una membresia que NO coincide.
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
    const socioOtroPlan = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioZoe.body.id, sede_origen_id: sedeId, plan: 'ANUAL' })
      .expect(201);

    const idCon = socioConMembresia.body.id;
    const idOtro = socioOtroPlan.body.id;

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

    // Contradiccion: cada uno tiene el plan del otro, no el suyo
    const porPlanAnual = await request(app.getHttpServer())
      .get('/api/v1/socios')
      .query({ plan: 'ANUAL' })
      .expect(200);
    expect(porPlanAnual.body.map((s) => s.id)).not.toContain(idCon);
    expect(porPlanAnual.body.map((s) => s.id)).toContain(idOtro);

    // Todo socio tiene membresia desde el alta: `estado_membresia: ACTIVA`
    // trae a los dos, y el filtro por plan separa al que no coincide.
    expect(porPlan.body.map((s) => s.id)).not.toContain(idOtro);
    expect(porEstado.body.map((s) => s.id)).toContain(idOtro);
    // Sin filtro de membresia si tiene que aparecer.
    expect(todos.body.map((s) => s.id)).toContain(idOtro);

    // nombre parcial sin distinguir mayusculas: 'carlos' -> 'Carlos Gomez'
    const porNombre = await request(app.getHttpServer())
      .get('/api/v1/socios')
      .query({ nombre: 'carlos' })
      .expect(200);
    expect(porNombre.body.map((s) => s.id)).toContain(idCon);
    expect(porNombre.body.map((s) => s.id)).not.toContain(idOtro);

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
      .send({ usuario_id: 999999, sede_origen_id: sedeId, plan: 'MENSUAL' })
      .expect(404);
  });

  it('POST /socios responde 422 si falta plan (no hay socio sin membresia)', async () => {
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Sin Plan E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
      })
      .expect(201);
    const usuarioId = usuarioRes.body.id;

    await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioId, sede_origen_id: sedeId })
      .expect(422);

    // El rechazo es total: no queda un socio a medias. El usuario sigue siendo
    // EXTERNO, asi que un reintento con plan funciona.
    const reintento = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioId, sede_origen_id: sedeId, plan: 'MENSUAL' })
      .expect(201);

    const membresiaRes = await request(app.getHttpServer())
      .get(`/api/v1/socios/${reintento.body.id}/membresias`)
      .expect(200);
    expect(membresiaRes.body.plan).toBe('MENSUAL');
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
      .send({ usuario_id: usuarioId, sede_origen_id: sedeId, plan: 'MENSUAL' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioId, sede_origen_id: sedeId, plan: 'MENSUAL' })
      .expect(409);
  });

  // El enum de entrada de MembresiaPatch.estado es [ACTIVA, SUSPENDIDA]: VENCIDA
  // queda afuera porque solo lo produce el proceso diario que vence las membresias
  // con fecha_fin ya pasada. Aceptarlo por API dejaba un VENCIDA con fecha_fin
  // futura, y esa fila la daba por vigente `estaVigente`
  // (m.estado !== 'SUSPENDIDA' && m.fecha_fin >= ahora), dejando entrar al socio.
  it('PATCH /socios/{id}/membresias con estado VENCIDA responde 422', async () => {
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Vencida Manual E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
      })
      .expect(201);

    const socioRes = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioRes.body.id, sede_origen_id: sedeId, plan: 'MENSUAL' })
      .expect(201);
    const socioId: number = socioRes.body.id;

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/socios/${socioId}/membresias`)
      .send({ estado: 'VENCIDA' })
      .expect(422);

    expect(res.body.status).toBe(422);
    expect(res.body.title).toBe('Error de validación');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.join(' ')).toContain('estado');

    // La fila no se toco: sigue ACTIVA y con fecha_fin en el futuro.
    const get = await request(app.getHttpServer())
      .get(`/api/v1/socios/${socioId}/membresias`)
      .expect(200);
    expect(get.body.estado).toBe('ACTIVA');
    expect(new Date(get.body.fecha_fin).getTime()).toBeGreaterThan(Date.now());
  });

  it('PATCH /socios/{id}/membresias suspende y reactiva una membresia', async () => {
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Suspender E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
      })
      .expect(201);

    const socioRes = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioRes.body.id, sede_origen_id: sedeId, plan: 'MENSUAL' })
      .expect(201);
    const socioId: number = socioRes.body.id;

    const suspender = await request(app.getHttpServer())
      .patch(`/api/v1/socios/${socioId}/membresias`)
      .send({ estado: 'SUSPENDIDA' })
      .expect(200);
    expect(suspender.body.estado).toBe('SUSPENDIDA');

    // Reactivar solo cambia `estado`: la fecha_fin no se recalcula porque el PATCH
    // no manda `plan`, y la membresia sigue vigente en el tiempo.
    const fechaFin = suspender.body.fecha_fin;
    const reactivar = await request(app.getHttpServer())
      .patch(`/api/v1/socios/${socioId}/membresias`)
      .send({ estado: 'ACTIVA' })
      .expect(200);
    expect(reactivar.body.estado).toBe('ACTIVA');
    expect(reactivar.body.fecha_fin).toBe(fechaFin);
  });

  // El cambio de plan es la unica operacion de M1 que toca el precio, asi que se
  // verifica por Prisma y no por la respuesta: `MembresiaOut` es lista blanca y
  // `precio` no sale por la API a proposito (M5 lo lee por el export angosto de M1).
  it('PATCH /socios/{id}/membresias con plan mueve precio y las DOS fechas juntas', async () => {
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Cambio De Plan E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
      })
      .expect(201);

    const socioRes = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioRes.body.id, sede_origen_id: sedeId, plan: 'MENSUAL' })
      .expect(201);
    const socioId: number = socioRes.body.id;

    const antes = await prisma.membresia.findUniqueOrThrow({
      where: { socio_id: socioId },
    });
    expect(antes.precio.toNumber()).toBe(PRECIOS_PLAN.MENSUAL);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/socios/${socioId}/membresias`)
      .send({ plan: 'TRIMESTRAL' })
      .expect(200);
    expect(res.body.plan).toBe('TRIMESTRAL');

    const despues = await prisma.membresia.findUniqueOrThrow({
      where: { socio_id: socioId },
    });

    // 1) El precio sigue al plan: sin esto, un socio que baja de plan seguiria
    //    pagando el precio del anterior y el cobro de M5 seria el monto viejo.
    expect(despues.precio.toNumber()).toBe(PRECIOS_PLAN.TRIMESTRAL);

    // 2) `fecha_inicio` arranca HOY, no en el alta original: el par queda internamente
    //    consistente y el periodo nuevo se conta completo desde el PATCH.
    const ahora = Date.now();
    const inicio = new Date(despues.fecha_inicio).getTime();
    expect(Math.abs(inicio - ahora)).toBeLessThanOrEqual(60_000);

    // 3) `fecha_fin` se recalcula a un trimestre DESDE el nuevo inicio. Si solo se
    //    hubiera escrito fecha_fin (el bug que cubria este test), fecha_inicio seguia
    //    siendo la del alta y el par describia un periodo ya vencido a medias.
    const esperado = new Date(despues.fecha_inicio);
    esperado.setMonth(esperado.getMonth() + 3);
    expect(new Date(despues.fecha_fin).toISOString()).toBe(esperado.toISOString());
    expect(new Date(despues.fecha_fin).getTime()).toBeGreaterThan(ahora);

    // 4) El cambio es INMEDIATO: el periodo nuevo arranca antes de que terminara el
    //    viejo y los dias que quedaban no se trasladan. Si la implementacion
    //    encadenara los periodos (anclar el nuevo en la fecha_fin anterior), el socio
    //    pagaria de mas este mes y la asercion 2 ya habria fallado.
    expect(new Date(despues.fecha_inicio).getTime()).toBeLessThan(
      new Date(antes.fecha_fin).getTime(),
    );
    expect(new Date(despues.fecha_inicio).getTime()).not.toBe(
      new Date(antes.fecha_fin).getTime(),
    );
  });

  // Los tres PATCH de M1 tienen DTOs con TODOS los campos opcionales, asi que un
  // body {} pasa la validacion. El problema no es el DTO sino lo que hay despues:
  // los services arman el objeto de cambios y lo mandan a Prisma, y un update
  // sin campos lanza PrismaClientValidationError. Eso no es el P2025 que los
  // repositorios saben convertir a null, asi que la excepcion se escapaba sin
  // traducir y la respuesta era 500. El contrato ya declara 422 en los tres.

  it('PATCH /usuarios/{id} con body vacio responde 422 y no 500', async () => {
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Patch Vacio Usuario E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
        telefono: '+54 351 555-1111',
      })
      .expect(201);

    const vacio = await request(app.getHttpServer())
      .patch(`/api/v1/usuarios/${usuarioRes.body.id}`)
      .send({})
      .expect(422);

    expect(vacio.headers['content-type']).toContain('application/problem+json');
    expect(vacio.body.status).toBe(422);

    // Un 422 por body vacio no puede haber tocado la fila.
    const despues = await request(app.getHttpServer())
      .get(`/api/v1/usuarios/${usuarioRes.body.id}`)
      .expect(200);
    expect(despues.body.telefono).toBe('+54 351 555-1111');
  });

  it('PATCH /socios/{socio_id} con body vacio responde 422 y no 500', async () => {
    // SocioPatch tiene un solo campo (sede_origen_id) y es opcional: con {} el
    // service construye un objeto de cambios vacio y lo pasa igual.
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Patch Vacio Socio E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
      })
      .expect(201);

    const socioRes = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioRes.body.id, sede_origen_id: sedeId, plan: 'MENSUAL' })
      .expect(201);

    const vacio = await request(app.getHttpServer())
      .patch(`/api/v1/socios/${socioRes.body.id}`)
      .send({})
      .expect(422);

    expect(vacio.headers['content-type']).toContain('application/problem+json');
    expect(vacio.body.status).toBe(422);

    const despues = await request(app.getHttpServer())
      .get(`/api/v1/socios/${socioRes.body.id}`)
      .expect(200);
    expect(despues.body.sede_origen_id).toBe(sedeId);
  });

  it('PATCH /socios/{socio_id}/membresias con body vacio responde 422 y no deja la membresia a medias', async () => {
    // Este es el caso mas delicado de los tres: MembresiaRepository arma el data
    // asignando los tres campos sin condicion, asi que con {} le llega
    // {plan: undefined, renueva_automatica: undefined, estado: undefined}.
    const usuarioRes = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .send({
        rol: 'EXTERNO',
        dni: dniUnico(),
        nombre: 'Patch Vacio Membresia E2E',
        email: emailUnico(),
        contrasenia: 'clave12345',
      })
      .expect(201);

    const socioRes = await request(app.getHttpServer())
      .post('/api/v1/socios')
      .send({ usuario_id: usuarioRes.body.id, sede_origen_id: sedeId, plan: 'TRIMESTRAL' })
      .expect(201);

    const antes = await request(app.getHttpServer())
      .get(`/api/v1/socios/${socioRes.body.id}/membresias`)
      .expect(200);

    const vacio = await request(app.getHttpServer())
      .patch(`/api/v1/socios/${socioRes.body.id}/membresias`)
      .send({})
      .expect(422);

    expect(vacio.headers['content-type']).toContain('application/problem+json');
    expect(vacio.body.status).toBe(422);

    // Ni el estado ni el plan ni la fecha_fin pueden haber cambiado: si el update
    // hubiera corrido con data vacio, la membresia quedaria incoherentente.
    const despues = await request(app.getHttpServer())
      .get(`/api/v1/socios/${socioRes.body.id}/membresias`)
      .expect(200);
    expect(despues.body.estado).toBe(antes.body.estado);
    expect(despues.body.plan).toBe(antes.body.plan);
    expect(despues.body.fecha_fin).toBe(antes.body.fecha_fin);
    expect(despues.body.renueva_automatica).toBe(antes.body.renueva_automatica);
  });
});
