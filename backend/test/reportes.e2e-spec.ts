import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/commons/database/prisma.service';
import { ProblemFilter } from '../src/commons/filters/problem.filter';
import { AppModule } from '../src/app.module';
import { PRECIOS_PLAN } from '../src/modules/m1-usuarios/entities/membresia.entity';

// Unidad IV (CQRS, read side): GET /reportes/pagos en PDF, solo GERENTE.
describe('Reportes: ingresos por período (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sedeId: number;
  let tokenGerente: string;
  let tokenSocio: string;
  let tokenRecepcion: string;

  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const sedesCreadas: number[] = [];
  const canchasCreadas: number[] = [];
  const reservasCreadas: number[] = [];
  const membresiasCreadas: number[] = [];
  const pagosCreados: number[] = [];

  const sufijo = `rep-${process.pid}-${Date.now()}`;
  const nombreSede = `Sede Reporte ${sufijo}`;
  // Un día lejano y propio: el reporte filtra por rango, así que no se mezcla con otros pagos.
  const DIA = '2026-03-05';
  const dniUnico = () => String(30000000 + Math.floor(Math.random() * 69999999));

  async function crearUsuario(rol: string, tag: string): Promise<{ id: number; email: string }> {
    const email = `rep.${tag}.${sufijo}@e2e.fitzone.test`;
    const usuario = await prisma.usuario.create({
      data: {
        rol: rol as never,
        dni: dniUnico(),
        nombre: `Reporte E2E ${tag}`,
        email,
        contrasenia: await bcrypt.hash('clave12345', 10),
      },
    });
    usuariosCreados.push(usuario.id);
    return { id: usuario.id, email };
  }

  async function token(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, contrasenia: 'clave12345' })
      .expect(200);
    return res.body.accessToken as string;
  }

  function pedir(query: string, bearer?: string) {
    const req = request(app.getHttpServer())
      .get(`/api/v1/reportes/pagos${query}`)
      .buffer(true)
      .parse((res, cb) => {
        const trozos: Buffer[] = [];
        res.on('data', (t: Buffer) => trozos.push(t));
        res.on('end', () => cb(null, Buffer.concat(trozos)));
      });
    return bearer ? req.set('Authorization', `Bearer ${bearer}`) : req;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new ProblemFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const sede = await prisma.sede.create({
      data: { nombre: nombreSede, direccion: 'Calle Reporte 1', aforo_maximo: 30 },
    });
    sedeId = sede.id;
    sedesCreadas.push(sede.id);

    const gerente = await crearUsuario('GERENTE', 'gerente');
    const recepcion = await crearUsuario('RECEPCION', 'recepcion');
    await prisma.empleadoSede.create({ data: { usuario_id: recepcion.id, sede_id: sedeId } });
    const socioUsuario = await crearUsuario('SOCIO', 'socio');
    const socio = await prisma.socio.create({
      data: { usuario_id: socioUsuario.id, sede_origen_id: sedeId, fecha_alta: new Date('2026-01-01') },
    });
    sociosCreados.push(socio.id);

    const membresia = await prisma.membresia.create({
      data: {
        socio_id: socio.id,
        plan: 'MENSUAL',
        estado: 'ACTIVA',
        fecha_inicio: new Date('2026-03-01'),
        fecha_fin: new Date('2026-03-31'),
        precio: PRECIOS_PLAN.MENSUAL,
        renueva_automatica: false,
      },
    });
    membresiasCreadas.push(membresia.id);

    const cancha = await prisma.cancha.create({
      data: { sede_id: sedeId, tipo: 'FUTBOL5', costo_por_hora: 5000, estado: 'OPERATIVA' },
    });
    canchasCreadas.push(cancha.id);
    const inicio = new Date(`${DIA}T18:00:00-03:00`);
    const reserva = await prisma.reserva.create({
      data: {
        cancha_id: cancha.id,
        usuario_id: socioUsuario.id,
        fecha_hora_inicio: inicio,
        fecha_hora_fin: new Date(inicio.getTime() + 3600_000),
        precio_aplicado: 7750,
        estado: 'CONFIRMADA',
      },
    });
    reservasCreadas.push(reserva.id);

    // Fixture directo en la base (el reporte solo lee): un APROBADO de cancha, uno de
    // membresía y un ANULADO que NO debe sumar.
    const nuevoPago = async (
      clave: string,
      monto: number,
      estado: 'APROBADO' | 'ANULADO',
      subtipo: Record<string, unknown>,
    ) => {
      const pago = await prisma.pago.create({
        data: {
          usuario_id: socioUsuario.id,
          idempotencia_key: `${clave}-${sufijo}`,
          fecha_pago: new Date(`${DIA}T12:00:00-03:00`),
          monto,
          estado,
          token: 'tok_aprobado_rep',
          ...subtipo,
        },
      });
      pagosCreados.push(pago.id);
    };
    await nuevoPago('rep-cancha', 7750, 'APROBADO', { pago_reserva: { create: { reserva_id: reserva.id } } });
    await nuevoPago('rep-membresia', 30000, 'APROBADO', {
      pago_membresia: { create: { membresia_id: membresia.id } },
    });
    await nuevoPago('rep-anulado', 999, 'ANULADO', {
      pago_membresia: { create: { membresia_id: membresia.id } },
    });

    tokenGerente = await token(gerente.email);
    tokenRecepcion = await token(recepcion.email);
    tokenSocio = await token(socioUsuario.email);
  });

  afterAll(async () => {
    await prisma.pagoReserva.deleteMany({ where: { id_pago: { in: pagosCreados } } });
    await prisma.pagoMembresia.deleteMany({ where: { id_pago: { in: pagosCreados } } });
    await prisma.pago.deleteMany({ where: { id: { in: pagosCreados } } });
    await prisma.reserva.deleteMany({ where: { id: { in: reservasCreadas } } });
    await prisma.cancha.deleteMany({ where: { id: { in: canchasCreadas } } });
    await prisma.membresia.deleteMany({ where: { id: { in: membresiasCreadas } } });
    await prisma.empleadoSede.deleteMany({ where: { usuario_id: { in: usuariosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
    await app.close();
  });

  it('GERENTE recibe 200 application/pdf con el consolidado de los APROBADO', async () => {
    const res = await pedir(`?desde=${DIA}&hasta=${DIA}`, tokenGerente).expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('reporte-ingresos.pdf');
    const pdf = res.body as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');

    const texto = (pdf.toString('latin1').match(/<([0-9a-fA-F]+)>/g) ?? [])
      .map((m) => (m.slice(1, -1).match(/../g) ?? []).map((b) => String.fromCharCode(parseInt(b, 16))).join(''))
      .join('');
    expect(texto).toContain(nombreSede);
    expect(texto).toContain(DIA);
    expect(texto).toContain('7.750,00');
    expect(texto).toContain('30.000,00');
    // 7.750 + 30.000; el ANULADO de 999 no entra.
    expect(texto).toContain('37.750,00');
  });

  it('SOCIO y RECEPCION reciben 403', async () => {
    await pedir('', tokenSocio).expect(403);
    await pedir('', tokenRecepcion).expect(403);
  });

  it('sin autenticación responde 401', async () => {
    await pedir('').expect(401);
  });

  it('desde inválido (2026-02-30) responde 422', async () => {
    await pedir('?desde=2026-02-30', tokenGerente).expect(422);
  });

  it('un parámetro fuera de la lista blanca responde 422', async () => {
    await pedir('?estado=APROBADO', tokenGerente).expect(422);
  });
});
