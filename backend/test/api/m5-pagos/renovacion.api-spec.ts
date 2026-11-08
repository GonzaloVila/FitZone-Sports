import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { PRECIOS_PLAN } from 'src/modules/m1-usuarios/entities/membresia.entity';
import { RenovacionesCron } from 'src/modules/m5-pagos/crons/renovaciones.cron';
import { crearApp, crearSede, dniUnico } from '@test/helpers/base-de-datos';

// RF-02: renovación automática. El cron corre a medianoche, pero el método es público
// y se invoca directo: cobra la membresía (mock siempre aprueba) y recién entonces
// extiende el período sobre la fechaFin previa (contiguo).
describe('M5 - Renovación automática de membresía (RF-02)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sedeId: number;

  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const membresiasCreadas: number[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    sedeId = await crearSede(prisma);
  });

  afterAll(async () => {
    await prisma.pagoMembresia.deleteMany({ where: { membresia_id: { in: membresiasCreadas } } });
    await prisma.pago.deleteMany({ where: { usuario_id: { in: usuariosCreados } } });
    await prisma.membresia.deleteMany({ where: { id: { in: membresiasCreadas } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: [sedeId] } } });
    await app.close();
  });

  async function crearSocioConMembresia(opciones: {
    renuevaAutomatica: boolean;
    estado: 'ACTIVA' | 'SUSPENDIDA';
    fechaFin: Date;
  }) {
    const usuario = await prisma.usuario.create({
      data: {
        rol: 'SOCIO',
        dni: dniUnico(),
        nombre: 'Renov E2E',
        email: `renov.${Date.now()}.${Math.floor(Math.random() * 1000)}@e2e.fitzone.test`,
        contrasenia: 'hash-no-relevante',
      },
    });
    usuariosCreados.push(usuario.id);

    const socio = await prisma.socio.create({
      data: { usuario_id: usuario.id, sede_origen_id: sedeId, fecha_alta: new Date() },
    });
    sociosCreados.push(socio.id);

    const membresia = await prisma.membresia.create({
      data: {
        socio_id: socio.id,
        plan: 'MENSUAL',
        estado: opciones.estado,
        fecha_inicio: new Date(opciones.fechaFin.getTime() - 30 * 86400000),
        fecha_fin: opciones.fechaFin,
        precio: PRECIOS_PLAN.MENSUAL,
        renueva_automatica: opciones.renuevaAutomatica,
      },
    });
    membresiasCreadas.push(membresia.id);
    return { usuarioId: usuario.id, membresiaId: membresia.id };
  }

  it('renueva una membresía vencida con renovación automática (cobra y extiende)', async () => {
    const fechaFin = new Date(Date.now() - 5 * 86400000);
    const { usuarioId, membresiaId } = await crearSocioConMembresia({
      renuevaAutomatica: true,
      estado: 'ACTIVA',
      fechaFin,
    });

    await app.get(RenovacionesCron).renovar();

    const pago = await prisma.pago.findFirst({
      where: { usuario_id: usuarioId, idempotencia_key: { startsWith: 'renov-' } },
    });
    expect(pago).not.toBeNull();
    expect(pago!.estado).toBe('APROBADO');
    expect(pago!.monto.toNumber()).toBe(PRECIOS_PLAN.MENSUAL);

    const membresia = await prisma.membresia.findUniqueOrThrow({ where: { id: membresiaId } });
    expect(membresia.estado).toBe('ACTIVA');
    expect(membresia.fecha_fin.getTime()).toBeGreaterThan(fechaFin.getTime());
  });

  it('no renueva si renueva_automatica es false ni si está SUSPENDIDA', async () => {
    const vencida = new Date(Date.now() - 5 * 86400000);
    const sinAuto = await crearSocioConMembresia({
      renuevaAutomatica: false,
      estado: 'ACTIVA',
      fechaFin: vencida,
    });
    const suspendida = await crearSocioConMembresia({
      renuevaAutomatica: true,
      estado: 'SUSPENDIDA',
      fechaFin: vencida,
    });

    await app.get(RenovacionesCron).renovar();

    for (const objetivo of [sinAuto, suspendida]) {
      const pago = await prisma.pago.findFirst({
        where: { usuario_id: objetivo.usuarioId, idempotencia_key: { startsWith: 'renov-' } },
      });
      expect(pago).toBeNull();
      const m = await prisma.membresia.findUniqueOrThrow({ where: { id: objetivo.membresiaId } });
      expect(m.fecha_fin.getTime()).toBe(vencida.getTime());
    }
  });

  it('renovación rechazada por la pasarela no renueva (queda vencida, sin pago)', async () => {
    const vencida = new Date(Date.now() - 5 * 86400000);
    const { usuarioId, membresiaId } = await crearSocioConMembresia({
      renuevaAutomatica: true,
      estado: 'ACTIVA',
      fechaFin: vencida,
    });

    // El cron COBRA antes de renovar: si la pasarela rechaza, no extiende la fecha.
    process.env.PASARELA_MOCK = 'RECHAZADO';
    try {
      await app.get(RenovacionesCron).renovar();
    } finally {
      delete process.env.PASARELA_MOCK;
    }

    const pago = await prisma.pago.findFirst({
      where: { usuario_id: usuarioId, idempotencia_key: { startsWith: 'renov-' } },
    });
    expect(pago).toBeNull();

    const membresia = await prisma.membresia.findUniqueOrThrow({ where: { id: membresiaId } });
    expect(membresia.fecha_fin.getTime()).toBe(vencida.getTime());
  });
});
