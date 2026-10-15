import type { INestApplication } from '@nestjs/common';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { PRECIOS_PLAN } from 'src/modules/m1-usuarios/entities/membresia.entity';
import { dniUnico } from '@test/helpers/base-de-datos';

// Fixtures compartidos por los e2e de M5 (antes en el beforeAll de m5.e2e-spec.ts).
// El contexto crea la sede + usuario/socio/membresia + cancha y expone helpers para
// reservar y cobrar. Cada archivo hace su `limpiar()` en el afterAll.
export async function crearContextoM5(app: INestApplication, prisma: PrismaService) {
  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const membresiasCreadas: number[] = [];
  const sedesCreadas: number[] = [];
  const canchasCreadas: number[] = [];
  const reservasCreadas: number[] = [];

  // Corre el horario de cada reserva para no chocar con `exq_reserva_turno`.
  let turnosReservados = 0;

  // El sufijo unico evita que una corrida previa que no limpio bien ensucie la base:
  // `idempotencia_key` es @unique GLOBAL.
  const sufijo = `m5-${process.pid}-${Date.now()}`;

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
  membresiasCreadas.push(membresia.id);

  const cancha = await prisma.cancha.create({
    data: { sede_id: sede.id, tipo: 'FUTBOL5', costo_por_hora: 5000, estado: 'OPERATIVA' },
  });
  canchasCreadas.push(cancha.id);

  // Cada test que cobra necesita SU PROPIA reserva (PagoReserva.reserva_id es @unique)
  // y su propio TURNO (exq_reserva_turno): por eso la hora corre con un contador.
  async function crearReserva(precio = 7750): Promise<number> {
    turnosReservados += 1;
    const inicio = new Date(Date.UTC(2026, 9, 10, 15 + turnosReservados, 0, 0));
    const reserva = await prisma.reserva.create({
      data: {
        cancha_id: cancha.id,
        usuario_id: usuario.id,
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
      .send({ concepto: { tipo: 'MEMBRESIA', membresiaId: membresia.id }, token });
  }

  // Limpieza en orden inverso a las FKs. Los comprobantes en disco se borran primero
  // (cualquier cobro APROBADO dejo un PDF en storage/comprobantes/).
  async function limpiar(): Promise<void> {
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

    await prisma.pagoReserva.deleteMany({ where: { reserva_id: { in: reservasCreadas } } });
    await prisma.pagoMembresia.deleteMany({ where: { membresia_id: { in: membresiasCreadas } } });
    await prisma.pago.deleteMany({ where: { usuario_id: { in: usuariosCreados } } });
    await prisma.reserva.deleteMany({ where: { id: { in: reservasCreadas } } });
    await prisma.cancha.deleteMany({ where: { id: { in: canchasCreadas } } });
    await prisma.membresia.deleteMany({ where: { id: { in: membresiasCreadas } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
  }

  return {
    sedeId: sede.id,
    usuarioId: usuario.id,
    membresiaId: membresia.id,
    canchaId: cancha.id,
    usuariosCreados,
    sociosCreados,
    membresiasCreadas,
    sedesCreadas,
    canchasCreadas,
    reservasCreadas,
    sufijo,
    crearReserva,
    cobroReserva,
    cobroMembresia,
    limpiar,
  };
}
