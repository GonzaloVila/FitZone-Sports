import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/commons/database/prisma.service';
import { ZONA_SEDE } from '../src/commons/fechas';
import { ProblemFilter } from '../src/commons/filters/problem.filter';
import { AppModule } from '../src/app.module';
import { PRECIOS_PLAN } from '../src/modules/m1-usuarios/entities/membresia.entity';

// RF-13: `POST /pagos`. Lo que se verifica acá es lo que un unitario no puede
// ver — la cabecera `Idempotency-Key` llegando al controller, el `Location` del 201,
// el `application/problem+json` del 4xx y que el `@unique` de la base sea el que
// corta el reintento y no una comprobación previa.
describe('M5 - Pagos: cobro por HTTP (RF-13)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const membresiasCreadas: number[] = [];
  const sedesCreadas: number[] = [];
  const canchasCreadas: number[] = [];
  const reservasCreadas: number[] = [];
  // Corre el horario de cada reserva para no chocar con `exq_reserva_turno`.
  let turnosReservados = 0;

  let usuarioId: number;
  let membresiaId: number;
  let canchaId: number;

  // El sufijo único evita que una corrida previa que no limpió bien ensucie la
  // base: `idempotencia_key` es `@unique` GLOBAL, así que repetir la clave entre
  // corridas rompería el primer test.
  const sufijo = `m5-${process.pid}-${Date.now()}`;
  const dniUnico = () => String(10000000 + Math.floor(Math.random() * 89999999));

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

    // El orden lo imponen las FKs: la sede va primero porque `Socio.sede_origen_id`
    // es obligatoria, así que sin ella no hay socio, y sin socio no hay membresía.
    const sede = await prisma.sede.create({
      data: { nombre: `Sede E2E ${sufijo}`, direccion: 'Calle Falsa 123', aforo_maximo: 40 },
    });
    sedesCreadas.push(sede.id);

    const usuario = await prisma.usuario.create({
      data: {
        rol: 'SOCIO',
        dni: dniUnico(),
        nombre: 'Socio E2E M5',
        email: `ana.${sufijo}@e2e.fitzone.test`,
        contrasenia: 'hash-no-relevante',
      },
    });
    usuarioId = usuario.id;
    usuariosCreados.push(usuario.id);

    const socio = await prisma.socio.create({
      data: { usuario_id: usuario.id, sede_origen_id: sede.id, fecha_alta: new Date('2026-01-01') },
    });
    sociosCreados.push(socio.id);

    const membresia = await prisma.membresia.create({
      data: {
        socio_id: socio.id,
        plan: 'MENSUAL',
        estado: 'ACTIVA',
        fecha_inicio: new Date('2026-10-01'),
        fecha_fin: new Date('2026-10-31'),
        precio: PRECIOS_PLAN.MENSUAL,
        renueva_automatica: false,
      },
    });
    membresiaId = membresia.id;
    membresiasCreadas.push(membresia.id);

    const cancha = await prisma.cancha.create({
      data: { sede_id: sede.id, tipo: 'FUTBOL5', costo_por_hora: 5000, estado: 'OPERATIVA' },
    });
    canchaId = cancha.id;
    canchasCreadas.push(cancha.id);
  });

  afterAll(async () => {
// Los comprobantes se limpian PRIMERO y sin llevar una lista de ids a mano: cualquier
    // cobro APROBADO de esta corrida deja un PDF real en `storage/comprobantes/`,
    // incluidos los de los tests de RF-13. Los usuarios del fixture son lo único que
    // distingue esos archivos de un comprobante real, así que se consultan antes de
    // borrar la base. Con una lista manual, el próximo test que apruebe un pago y olvide
    // la línea deja un archivo tirado en el repo.
    const pagos = await prisma.pago.findMany({
      where: { usuario_id: { in: usuariosCreados } },
      select: { comprobante_pdf_url: true },
    });
    await Promise.all(
      pagos.flatMap((pago) =>
        pago.comprobante_pdf_url
          ? [
              rm(
                join(
                  process.cwd(),
                  'storage',
                  'comprobantes',
                  pago.comprobante_pdf_url.slice(pago.comprobante_pdf_url.lastIndexOf('/') + 1),
                ),
                { force: true },
              ),
            ]
          : [],
      ),
    );

    // Orden inverso a las FKs. Los subtipos van PRIMERO porque `PagoReserva.id_pago`
    // y `PagoMembresia.id_pago` son FK a Pago con `onDelete: RESTRICT`: borrar el
    // pago antes rebota con 23001 y el fixture se queda tirado en la base. (No es
    // cascada, y conviene que no lo sea.)
    await prisma.pagoReserva.deleteMany({
      where: { reserva_id: { in: reservasCreadas } },
    });
    await prisma.pagoMembresia.deleteMany({
      where: { membresia_id: { in: membresiasCreadas } },
    });
    await prisma.pago.deleteMany({ where: { usuario_id: { in: usuariosCreados } } });
    await prisma.reserva.deleteMany({ where: { id: { in: reservasCreadas } } });
    await prisma.cancha.deleteMany({ where: { id: { in: canchasCreadas } } });
    await prisma.membresia.deleteMany({ where: { id: { in: membresiasCreadas } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
    await app.close();
  });

  /**
   * Cada test que cobra necesita SU PROPIA reserva: `PagoReserva.reserva_id` es
   * `@unique`, así que dos pruebas que cobren la misma reserva no probarían el
   * idempotencia sino el conflicto, y el resultado dependería del orden.
   *
   * Y cada una necesita además un TURNO propio: la base tiene la restricción de
   * exclusión `exq_reserva_turno` sobre `(cancha_id, tstzrange(inicio, fin))`, así
   * que dos reservas en el mismo horario rebotan con 23P01 aunque sean de pruebas
   * distintas. Por eso la hora corre con un contador en vez de una fija.
   */
  async function crearReserva(precio = 7750): Promise<number> {
    turnosReservados += 1;
    const inicio = new Date(Date.UTC(2026, 9, 10, 15 + turnosReservados, 0, 0));

    const reserva = await prisma.reserva.create({
      data: {
        cancha_id: canchaId,
        usuario_id: usuarioId,
        fecha_hora_inicio: inicio,
        fecha_hora_fin: new Date(inicio.getTime() + 60 * 60 * 1000),
        precio_aplicado: precio,
        estado: 'CONFIRMADA',
      },
    });
    reservasCreadas.push(reserva.id);
    return reserva.id;
  }

  function cobroReserva(reservaId: number, clave: string, token = 'tok_aprobado_abc') {
    return request(app.getHttpServer())
      .post('/api/v1/pagos')
      .set('Idempotency-Key', clave)
      .send({ concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: reservaId }, token });
  }

  function cobroMembresia(clave: string, token = 'tok_aprobado_abc') {
    return request(app.getHttpServer())
      .post('/api/v1/pagos')
      .set('Idempotency-Key', clave)
      .send({ concepto: { tipo: 'MEMBRESIA', membresiaId: membresiaId }, token });
  }

  /**
   * El día local de un instante, en `YYYY-MM-DD`, en la zona de la sede.
   *
   * Armado con `formatToParts` en vez del atajo `en-CA` porque el atajo depende de los
   * datos de ICU del build y este test necesita exactamente tres campos, en ese orden.
   */
  function diaLocal(instante: Date): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: ZONA_SEDE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(instante);

    const valor = (tipo: Intl.DateTimeFormatPartTypes): string =>
      partes.find((p) => p.type === tipo)!.value;

    return `${valor('year')}-${valor('month')}-${valor('day')}`;
  }

  /**
   * El texto impreso en el PDF.
   *
   * pdfkit escribe cada texto como hex dentro del content stream y lo parte en varios
   * runs por el kerning, así que hay que decodificar y pegar sin separador. Es la misma
   * lectura que hace `comprobantes.service.spec.ts`; acá se replica porque los tests de
   * capa y los de endpoint tienen que poder afirmar lo mismo: que el documento entregado
   * por HTTP dice el monto correcto.
   */
  function desmontarTexto(buffer: string): string {
    return (buffer.match(/<([0-9a-fA-F]+)>/g) ?? [])
      .map((m) => m.slice(1, -1))
      .map((hex) =>
        (hex.match(/../g) ?? [])
          .map((byte) => String.fromCharCode(parseInt(byte, 16)))
          .join(''),
      )
      .join('');
  }

  describe('happy path', () => {
    it('cobra una reserva con el precio congelado y responde 201 + Location', async () => {
      const reservaId = await crearReserva(7750);

      const res = await cobroReserva(reservaId, `happy-${sufijo}`).expect(201);

      expect(res.headers.location).toMatch(/^\/api\/v1\/pagos\/\d+$/);
      expect(Number(res.headers.location.split('/').pop())).toBe(res.body.id);
      expect(res.body).toMatchObject({
        usuarioId: usuarioId,
        concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: reservaId },
        // El monto lo copia `precio_aplicado`, NO el `costo_por_hora` de la cancha
        // (5000): la diferencia de 2750 es justamente la prueba de que M5 copia el
        // precio congelado y no recalcula nada.
        monto: 7750,
        moneda: 'ARS',
        estado: 'APROBADO',
      });
    });

    it('no devuelve el token ni la clave de idempotencia (RNF-02)', async () => {
      const reservaId = await crearReserva();

      const res = await cobroReserva(reservaId, `rnf-${sufijo}`).expect(201);

      expect(res.body).not.toHaveProperty('token');
      expect(res.body).not.toHaveProperty('idempotenciaKey');
    });

    it('cobra una membresía con el precio de su plan', async () => {
      const res = await cobroMembresia(`memb-${sufijo}`).expect(201);

      expect(res.body).toMatchObject({
        concepto: { tipo: 'MEMBRESIA', membresiaId: membresiaId },
        monto: 30000,
        estado: 'APROBADO',
      });
    });

    it('deja PENDIENTE el pago cuando la pasarela no resuelve', async () => {
      const reservaId = await crearReserva();

      const res = await cobroReserva(reservaId, `pend-${sufijo}`, 'tok_pendiente_abc').expect(201);

      expect(res.body.estado).toBe('PENDIENTE');
      // Y no se transitió: en la base sigue PENDIENTE, no APROBADO.
      const pago = await prisma.pago.findUnique({ where: { idempotencia_key: `pend-${sufijo}` } });
      expect(pago?.estado).toBe('PENDIENTE');
    });
  });

  describe('idempotencia', () => {
    it('rechaza con 409 el reintento con la misma clave y deja UN solo pago', async () => {
      const reservaId = await crearReserva();
      const clave = `dup-${sufijo}`;

      await cobroReserva(reservaId, clave).expect(201);

      const repetido = await cobroReserva(reservaId, clave).expect(409);

      expect(repetido.headers['content-type']).toContain('application/problem+json');
      expect(repetido.body).toMatchObject({
        type: 'https://fitzone.app/errores/idempotencia-repetida',
        title: 'Idempotency-Key repetida',
        status: 409,
      });

      // Lo importante: el cobro NO se duplicó. Una fila, no dos.
      expect(await prisma.pago.count({ where: { idempotencia_key: clave } })).toBe(1);
    });

    it('rechaza con 409 la misma reserva cobrada con una clave nueva, y no es idempotencia', async () => {
      const reservaId = await crearReserva();
      await cobroReserva(reservaId, `primero-${sufijo}`).expect(201);

      // Clave NUEVA sobre la misma reserva: no es un reintento del cliente, es un
      // intento de cobrar dos veces lo mismo. Por eso el detail habla de la reserva
      // y no de la clave.
      const repetido = await cobroReserva(reservaId, `segundo-${sufijo}`).expect(409);

      expect(repetido.body.status).toBe(409);
      expect(repetido.body.detail).toContain(String(reservaId));
      expect(repetido.body.title).not.toBe('Idempotency-Key repetida');
      expect(await prisma.pagoReserva.count({ where: { reserva_id: reservaId } })).toBe(1);
    });

    it('no inserta el pago si la clave está repetida aunque el concepto sea otro', async () => {
      const clave = `misma-clave-otro-concepto-${sufijo}`;
      const reservaId = await crearReserva();

      await cobroReserva(reservaId, clave).expect(201);
      await cobroMembresia(clave).expect(409);

      expect(await prisma.pago.count({ where: { idempotencia_key: clave } })).toBe(1);
    });
  });

  describe('validación de transporte y de negocio', () => {
    it('400 si falta la cabecera Idempotency-Key, sin insertar nada', async () => {
      const antes = await prisma.pago.count();

      const res = await request(app.getHttpServer())
        .post('/api/v1/pagos')
        .send({ concepto: { tipo: 'MEMBRESIA', membresiaId: membresiaId }, token: 'tok_aprobado_1' })
        .expect(400);

      expect(res.body).toMatchObject({ title: 'Falta Idempotency-Key', status: 400 });
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(await prisma.pago.count()).toBe(antes);
    });

    it('404 si el concepto no existe, sin insertar nada', async () => {
      const antes = await prisma.pago.count();

      const res = await request(app.getHttpServer())
        .post('/api/v1/pagos')
        .set('Idempotency-Key', `404-${sufijo}`)
        .send({ concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: 999999 }, token: 'tok_aprobado_1' })
        .expect(404);

      expect(res.body.status).toBe(404);
      expect(await prisma.pago.count()).toBe(antes);
    });

    it('404 si la reserva de clase de la penalidad no existe (RF-07)', async () => {
      const antes = await prisma.pago.count();

      const res = await request(app.getHttpServer())
        .post('/api/v1/pagos')
        .set('Idempotency-Key', `404-clase-${sufijo}`)
        .send({ concepto: { tipo: 'RESERVA_CLASE', reservaClaseId: 999999 }, token: 'tok_aprobado_1' })
        .expect(404);

      expect(res.body.status).toBe(404);
      expect(await prisma.pago.count()).toBe(antes);
    });

    it('402 si la pasarela rechaza, y el pago queda persistido como RECHAZADO', async () => {
      const reservaId = await crearReserva();
      const clave = `rech-${sufijo}`;

      const res = await cobroReserva(reservaId, clave, 'tok_basura').expect(402);

      expect(res.body).toMatchObject({ status: 402, title: 'Pago rechazado' });
      // El rechazo es un resultado de negocio: el pago existe y se puede listar.
      const pago = await prisma.pago.findUnique({ where: { idempotencia_key: clave } });
      expect(pago?.estado).toBe('RECHAZADO');
    });

    it('422 si el concepto manda los dos ids', async () => {
      const reservaId = await crearReserva();

      await request(app.getHttpServer())
        .post('/api/v1/pagos')
        .set('Idempotency-Key', `oneof-ambos-${sufijo}`)
        .send({
          concepto: { tipo: 'MEMBRESIA', membresiaId: membresiaId, reservaCanchaId: reservaId },
          token: 'tok_aprobado_1',
        })
        .expect(422);
    });

    it('422 si un concepto RESERVA_CLASE manda otro id (oneOf, RF-07)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/pagos')
        .set('Idempotency-Key', `oneof-clase-${sufijo}`)
        .send({
          concepto: { tipo: 'RESERVA_CLASE', reservaClaseId: 1, membresiaId: membresiaId },
          token: 'tok_aprobado_1',
        })
        .expect(422);
    });

    it('422 si el concepto no manda el id que le corresponde', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/pagos')
        .set('Idempotency-Key', `oneof-ninguno-${sufijo}`)
        .send({ concepto: { tipo: 'MEMBRESIA' }, token: 'tok_aprobado_1' })
        .expect(422);
    });

    it('422 si el body manda el monto, porque el importe no lo decide el cliente', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/pagos')
        .set('Idempotency-Key', `monto-${sufijo}`)
        .send({
          concepto: { tipo: 'MEMBRESIA', membresiaId: membresiaId },
          token: 'tok_aprobado_1',
          monto: 1,
        })
        .expect(422);
    });

    it('422 si manda una moneda que no sea ARS', async () => {
      await cobroMembresia(`usd-${sufijo}`, 'tok_aprobado_1')
        .send({ concepto: { tipo: 'MEMBRESIA', membresiaId: membresiaId }, token: 'tok_aprobado_1', moneda: 'USD' })
        .expect(422);
    });
  });

  // RF-14. El smoke del bloque 3 pide exactamente esto: un pago APROBADO tiene
  // `comprobante_pdf_url` y el endpoint devuelve el PDF; un RECHAZADO responde 409 sin
  // generar archivo.
  describe('comprobante en PDF', () => {
    function comprobante(pagoId: number) {
      return request(app.getHttpServer()).get(`/api/v1/pagos/${pagoId}/comprobante`);
    }

    it('el 201 de un cobro aprobado ya trae comprobante_pdf_url', async () => {
      const reservaId = await crearReserva(7750);

      const res = await cobroReserva(reservaId, `pdf-${sufijo}`).expect(201);

      expect(res.body.comprobantePdfUrl).toBe(`/storage/comprobantes/${res.body.id}.pdf`);
      const pago = await prisma.pago.findUnique({ where: { id: res.body.id } });
      expect(pago?.comprobante_pdf_url).toBe(`/storage/comprobantes/${res.body.id}.pdf`);
    });

    it('devuelve el PDF con application/pdf y el monto congelado de la reserva', async () => {
      const reservaId = await crearReserva(7750);
      const cobrado = await cobroReserva(reservaId, `pdf-get-${sufijo}`).expect(201);
      const id = cobrado.body.id as number;

      const res = await comprobante(id).expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain(`comprobante-pago-${id}.pdf`);

      const cuerpo = res.body as Buffer;
      expect(cuerpo.subarray(0, 5).toString()).toBe('%PDF-');

      // El monto del PDF tiene que ser el `precio_aplicado` de la reserva (7750), no el
      // precio de la cancha: es el mismo criterio de "M5 copia, no recalcula" que
      // verifica el POST, aplicado al documento que se le entrega al socio.
      const texto = Buffer.from(cuerpo).toString('latin1');
      expect(texto).toContain('<');
      expect(desmontarTexto(texto)).toContain('ARS 7.750,00');
    });

    it('el PDF lleva cancha y horario de la reserva (RF-14)', async () => {
      const reservaId = await crearReserva(7750);
      const cobrado = await cobroReserva(reservaId, `pdf-detalle-${sufijo}`).expect(201);
      const id = cobrado.body.id as number;

      const texto = desmontarTexto(((await comprobante(id).expect(200)).body as Buffer).toString('latin1'));

      expect(texto).toContain('Cancha:');
      expect(texto).toContain(`N° ${canchaId}`);
      expect(texto).toContain('Horario:');
      expect(texto).toContain('Reserva de cancha');
    });

    it('409 y ningún archivo generado si el pago fue rechazado', async () => {
      const reservaId = await crearReserva();
      const clave = `pdf-rech-${sufijo}`;

      await cobroReserva(reservaId, clave, 'tok_basura').expect(402);
      const pago = await prisma.pago.findUnique({ where: { idempotencia_key: clave } });
      const id = pago!.id;

      // El rechazo nunca tuvo comprobante: el archivo no existe, no se finge que sí.
      expect(pago!.comprobante_pdf_url).toBeNull();
      const res = await comprobante(id).expect(409);
      expect(res.body.title).toBe('Pago no aprobado');
      expect(res.body.detail).toContain('RECHAZADO');
    });

    it('409 si el pago quedó PENDIENTE', async () => {
      const reservaId = await crearReserva();
      const cobrado = await cobroReserva(reservaId, `pdf-pend-${sufijo}`, 'tok_pendiente_abc').expect(201);

      const res = await comprobante(cobrado.body.id).expect(409);

      expect(res.body.title).toBe('Pago no aprobado');
      expect(cobrado.body.comprobantePdfUrl).toBeNull();
    });

    it('404 si el pago no existe', async () => {
      const res = await comprobante(999999).expect(404);

      expect(res.body.status).toBe(404);
    });

    it('404 si la columna apunta a un archivo que ya no está', async () => {
      const reservaId = await crearReserva();
      const cobrado = await cobroReserva(reservaId, `pdf-borrado-${sufijo}`).expect(201);
      const id = cobrado.body.id as number;

      await rm(join(process.cwd(), 'storage', 'comprobantes', `${id}.pdf`), { force: true });

      const res = await comprobante(id).expect(404);
      expect(res.body.status).toBe(404);
    });
  });

  describe('listado, consulta y anulación', () => {
    function listar(query = '') {
      return request(app.getHttpServer()).get(`/api/v1/pagos${query}`);
    }

    function anular(pagoId: number) {
      return request(app.getHttpServer()).post(`/api/v1/pagos/${pagoId}/anulaciones`);
    }

    async function cobrarYAnular(clave: string, token = 'tok_aprobado_abc'): Promise<number> {
      const reservaId = await crearReserva();
      const cobrado = await cobroReserva(reservaId, clave, token).expect(201);
      await anular(cobrado.body.id).expect(204);
      return cobrado.body.id as number;
    }

    // El filtro por `usuario_id` es el que más se nota cuando está mal: si no llegara
    // al WHERE, la respuesta sería la lista completa y el test igual tendría pagos que
    // assertar. Por eso compara contra la lista sin filtro, no contra un número fijo.
    it('filtra por usuario y por estado', async () => {
      const reservaId1 = await crearReserva();
      const reservaId2 = await crearReserva();
      const mio = await cobroReserva(reservaId1, `filtro-${sufijo}`).expect(201);
      const otro = await cobroReserva(reservaId2, `filtro-otro-${sufijo}`, 'tok_pendiente_abc').expect(201);

      const sinFiltro = await listar(`?usuarioId=${usuarioId}`).expect(200);
      const mios = sinFiltro.body.filter((p: { id: number }) => p.id === mio.body.id);
      expect(mios).toHaveLength(1);

      const deOtro = await listar(`?usuarioId=${usuarioId}&estado=PENDIENTE`).expect(200);
      expect(deOtro.body.map((p: { id: number }) => p.id)).toContain(otro.body.id);
      expect(deOtro.body.map((p: { id: number }) => p.id)).not.toContain(mio.body.id);
    });

    // El default a APROBADO es la regla del módulo. Sin `?estado=`, un PENDIENTE (que
    // existe porque el cobro quedó colgado) no debe aparecer en el listado de pagos.
    it('sin estado devuelve solo APROBADO', async () => {
      const reservaId1 = await crearReserva();
      const reservaId2 = await crearReserva();
      const aprobado = await cobroReserva(reservaId1, `def-${sufijo}`).expect(201);
      const pendiente = await cobroReserva(reservaId2, `def-pend-${sufijo}`, 'tok_pendiente_abc').expect(201);

      const res = await listar(`?usuarioId=${usuarioId}`).expect(200);

      expect(res.body.map((p: { id: number }) => p.id)).toContain(aprobado.body.id);
      expect(res.body.map((p: { id: number }) => p.id)).not.toContain(pendiente.body.id);
    });

    // El filtro `tipo` es el discriminante del oneOf de ConceptoPago: si solo se
    // preguntara por la existencia del subtipo, `?tipo=RESERVA_CANCHA` traería también
    // los pagos de membresía.
    it('filtra por tipo de concepto y por id de concepto', async () => {
      const reservaId = await crearReserva();
      await cobroReserva(reservaId, `tipo-res-${sufijo}`).expect(201);
      await cobroMembresia(`tipo-mem-${sufijo}`).expect(201);

      const soloReserva = await listar(`?usuarioId=${usuarioId}&tipo=RESERVA_CANCHA`).expect(200);
      expect(soloReserva.body.every((p: { concepto: { tipo: string } }) => p.concepto.tipo === 'RESERVA_CANCHA')).toBe(true);

      const porReserva = await listar(`?reservaCanchaId=${reservaId}`).expect(200);
      expect(porReserva.body).toHaveLength(1);
      expect(porReserva.body[0].concepto).toEqual({ tipo: 'RESERVA_CANCHA', reservaCanchaId: reservaId });
    });

    // `desde`/`hasta` son días INCLUSIVOS. La prueba de que `hasta` es inclusivo es el
    // borde de arriba: si el `hasta` fuera exclusivo, `?desde=X&hasta=X` traería cero.
    it('el rango de fechas incluye el último día (hasta es inclusivo)', async () => {
      const reservaId = await crearReserva();
      const cobrado = await cobroReserva(reservaId, `rango-${sufijo}`).expect(201);
      const pago = await prisma.pago.findUniqueOrThrow({ where: { id: cobrado.body.id } });

      // El día local del pago, derivado acá con Intl y NO con `rangoDelDia()`: si el test
      // usara el mismo helper de la implementación, pasaría aunque los dos estuvieran
      // mal (por ejemplo, interpreting "hora local" como UTC).
      const dia = diaLocal(pago.fecha_pago);
      const ayer = diaLocal(new Date(pago.fecha_pago.getTime() - 86400000));

      const unDia = await listar(`?desde=${dia}&hasta=${dia}&perPage=100`).expect(200);
      expect(unDia.body.map((p: { id: number }) => p.id)).toContain(cobrado.body.id);

      // Y el rango no se come días de más: terminándolo en el día anterior, el pago
      // queda afuera.
      const antes = await listar(`?desde=${ayer}&hasta=${ayer}&perPage=100`).expect(200);
      expect(antes.body.map((p: { id: number }) => p.id)).not.toContain(cobrado.body.id);
    });

    it('pagina: per_page recorta y page avanza', async () => {
      const reservaId1 = await crearReserva();
      const reservaId2 = await crearReserva();
      await cobroReserva(reservaId1, `pag-1-${sufijo}`).expect(201);
      await cobroReserva(reservaId2, `pag-2-${sufijo}`).expect(201);

      const primera = await listar(`?usuarioId=${usuarioId}&perPage=1&page=1`).expect(200);
      const segunda = await listar(`?usuarioId=${usuarioId}&perPage=1&page=2`).expect(200);

      expect(primera.body).toHaveLength(1);
      expect(segunda.body).toHaveLength(1);
      expect(primera.body[0].id).not.toBe(segunda.body[0].id);
    });

    it('no devuelve el token ni la clave de idempotencia en el listado', async () => {
      const reservaId = await crearReserva();
      await cobroReserva(reservaId, `sin-token-${sufijo}`).expect(201);

      const res = await listar(`?usuarioId=${usuarioId}`).expect(200);

      expect(res.body.length).toBeGreaterThan(0);
      for (const pago of res.body) {
        expect(pago).not.toHaveProperty('token');
        expect(pago).not.toHaveProperty('idempotenciaKey');
      }
    });

    it('422 si un filtro no es válido o no está en la lista blanca', async () => {
      await listar('?estado=COBRADO').expect(422);
      await listar('?desde=2026-02-30').expect(422);
      await listar('?page=0').expect(422);
      await listar('?perPage=101').expect(422);
      await listar('?orden=cualquiera').expect(422);
    });

    it('devuelve el pago por id, sin token ni clave', async () => {
      const reservaId = await crearReserva();
      const cobrado = await cobroReserva(reservaId, `detalle-${sufijo}`).expect(201);

      const res = await request(app.getHttpServer()).get(`/api/v1/pagos/${cobrado.body.id}`).expect(200);

      expect(res.body.id).toBe(cobrado.body.id);
      expect(res.body.estado).toBe('APROBADO');
      expect(res.body).not.toHaveProperty('token');
      expect(res.body).not.toHaveProperty('idempotenciaKey');
    });

    it('404 al pedir un pago que no existe', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/pagos/999999').expect(404);
      expect(res.body.status).toBe(404);
    });

    it('anula un pago APROBADO: 204 sin cuerpo y queda ANULADO', async () => {
      const id = await cobrarYAnular(`anular-${sufijo}`);

      const res = await anular(id).expect(204);

      expect(res.body).toEqual({});
      const pago = await prisma.pago.findUniqueOrThrow({ where: { id } });
      expect(pago.estado).toBe('ANULADO');
    });

    // Reanular es idempotente por contrato: 204 otra vez, y el pago sigue ANULADO (no un
    // error, no un estado raro).
    it('reanular un ANULADO responde 204 y no cambia nada', async () => {
      const id = await cobrarYAnular(`anular-idem-${sufijo}`);

      await anular(id).expect(204);

      const pago = await prisma.pago.findUniqueOrThrow({ where: { id } });
      expect(pago.estado).toBe('ANULADO');
    });

    it('anula un pago PENDIENTE sin intentar devolverlo', async () => {
      const reservaId = await crearReserva();
      const cobrado = await cobroReserva(reservaId, `anular-pend-${sufijo}`, 'tok_pendiente_abc').expect(201);

      await anular(cobrado.body.id).expect(204);

      const pago = await prisma.pago.findUniqueOrThrow({ where: { id: cobrado.body.id } });
      expect(pago.estado).toBe('ANULADO');
    });

    // Nunca se cobró: no hay nada que devolver, así que 409 y el estado intacto.
    it('409 si el pago está RECHAZADO, y sigue RECHAZADO', async () => {
      const reservaId = await crearReserva();
      const clave = `anular-rech-${sufijo}`;
      await cobroReserva(reservaId, clave, 'tok_basura').expect(402);
      const pago = await prisma.pago.findUniqueOrThrow({ where: { idempotencia_key: clave } });

      const res = await anular(pago.id).expect(409);

      expect(res.body.title).toBe('Pago no anulable');
      expect(res.body.status).toBe(409);
      const sigue = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } });
      expect(sigue.estado).toBe('RECHAZADO');
    });

    it('404 si se anula un pago que no existe', async () => {
      await anular(999999).expect(404);
    });

    // El flujo completo del plan: anular un cobro de reserva deja la reserva tal cual
    // (M5 no la cancela; eso es de M4) y el pago disponible para el listado con su
    // estado nuevo.
    it('el pago anulado se sigue viendo en el listado, con estado ANULADO', async () => {
      const id = await cobrarYAnular(`anular-listado-${sufijo}`);

      const res = await listar(`?usuarioId=${usuarioId}&estado=ANULADO`).expect(200);

      const encontrado = res.body.find((p: { id: number }) => p.id === id);
      expect(encontrado).toBeDefined();
      expect(encontrado.estado).toBe('ANULADO');
    });
  });
});