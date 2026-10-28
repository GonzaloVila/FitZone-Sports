import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { PRECIOS_PLAN } from 'src/modules/m1-usuarios/entities/membresia.entity';
import { PagosModule } from 'src/modules/m5-pagos/pagos.module';
import { PagosService } from 'src/modules/m5-pagos/services/pagos.service';
import { crearSede, crearSocioConMembresia } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

// Integration: bootea PagosModule (+ M1/M3/M4 por sus servicios de precio) contra la
// BD real. Cubre el cobro de punta a punta con la pasarela mock, la idempotencia por
// @unique, la anulación y el comprobante — lo que en e2e sobraba.
describe('M5 PagosService (integration, BD real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let pagos: PagosService;
  let sedeId: number;
  let usuarioId: number;
  let membresiaId: number;

  beforeAll(async () => {
    moduleRef = await crearModuloDeIntegracion(PagosModule);
    prisma = moduleRef.get(PrismaService);
    pagos = moduleRef.get(PagosService);
    sedeId = await crearSede(prisma);

    const socio = await crearSocioConMembresia(prisma, { sedeId, vigente: true, plan: 'MENSUAL' });
    usuarioId = socio.usuarioId;
    const membresia = await prisma.membresia.findFirstOrThrow({ where: { socio_id: socio.socioId } });
    membresiaId = membresia.id;
  });

  afterAll(async () => {
    await prisma.pagoMembresia.deleteMany({ where: { membresia_id: membresiaId } });
    await prisma.pago.deleteMany({ where: { usuario_id: usuarioId } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: (await prisma.socio.findMany({ where: { usuario_id: usuarioId }, select: { id: true } })).map((s) => s.id) } } });
    await prisma.socio.deleteMany({ where: { usuario_id: usuarioId } });
    await prisma.usuario.delete({ where: { id: usuarioId } });
    await prisma.sede.delete({ where: { id: sedeId } });
    await moduleRef.close();
  });

  const conceptoSocio = () => ({ tipo: 'MEMBRESIA', membresiaId });
  const nuevaKey = (): string => `it-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  it('cobra una membresía aprobada: copia el monto del plan, APROBADO y con comprobante', async () => {
    const pago = await pagos.procesarPago({ concepto: conceptoSocio(), token: 'tok_aprobado_1' } as never, nuevaKey());

    expect(pago.estado).toBe('APROBADO');
    expect(pago.usuarioId).toBe(usuarioId);
    expect(pago.monto).toBeCloseTo(PRECIOS_PLAN.MENSUAL, 2);
    expect(pago.comprobantePdfUrl).toBeTruthy();

    const fila = await prisma.pago.findUnique({ where: { id: pago.id } });
    expect(fila?.estado).toBe('APROBADO');
    expect(Number(fila?.monto)).toBeCloseTo(PRECIOS_PLAN.MENSUAL, 2);
  });

  it('rechazo: responde 402 pero el pago queda persistido como RECHAZADO', async () => {
    const key = nuevaKey();
    await expect(pagos.procesarPago({ concepto: conceptoSocio(), token: 'tok_rechazado' } as never, key)).rejects.toBeInstanceOf(
      ProblemException,
    );

    const fila = await prisma.pago.findUnique({ where: { idempotencia_key: key } });
    expect(fila?.estado).toBe('RECHAZADO');
    expect(fila?.comprobante_pdf_url).toBeNull();
  });

  it('pendiente: queda PENDIENTE y sin comprobante (no transiciona)', async () => {
    const key = nuevaKey();
    const pago = await pagos.procesarPago({ concepto: conceptoSocio(), token: 'tok_pendiente_1' } as never, key);

    expect(pago.estado).toBe('PENDIENTE');
    const fila = await prisma.pago.findUnique({ where: { id: pago.id } });
    expect(fila?.estado).toBe('PENDIENTE');
    expect(fila?.comprobante_pdf_url).toBeNull();
  });

  it('idempotencia repetida: la segunda vez con la MISMA clave → 409 y no toca la pasarela', async () => {
    const key = nuevaKey();
    await pagos.procesarPago({ concepto: conceptoSocio(), token: 'tok_aprobado_2' } as never, key);

    await expect(pagos.procesarPago({ concepto: conceptoSocio(), token: 'tok_aprobado_2' } as never, key)).rejects.toBeInstanceOf(
      ProblemException,
    );
  });

  it('listar: default solo APROBADO; TODOS trae todos los estados; con estado explícito trae solo ese', async () => {
    const aprobado = await pagos.procesarPago({ concepto: conceptoSocio(), token: 'tok_aprobado_3' } as never, nuevaKey());
    const rechazadoKey = nuevaKey();
    await expect(pagos.procesarPago({ concepto: conceptoSocio(), token: 'tok_rechazado' } as never, rechazadoKey)).rejects.toBeInstanceOf(
      ProblemException,
    );

    const porDefecto = await pagos.listarPagos({ usuarioId, page: 1, perPage: 100 });
    expect(porDefecto.items.every((p) => p.estado === 'APROBADO')).toBe(true);
    expect(porDefecto.items.map((p) => p.id)).toContain(aprobado.id);

    const rechazados = await pagos.listarPagos({ usuarioId, estado: 'RECHAZADO', page: 1, perPage: 100 });
    expect(rechazados.items.every((p) => p.estado === 'RECHAZADO')).toBe(true);
    expect(rechazados.items.length).toBeGreaterThan(0);

    // TODOS quita el filtro: trae el aprobado y el rechazado de este test, y el total cuenta todos los del usuario.
    const rechazado = await prisma.pago.findUniqueOrThrow({ where: { idempotencia_key: rechazadoKey } });
    const todos = await pagos.listarPagos({ usuarioId, estado: 'TODOS', page: 1, perPage: 100 });
    expect(todos.items.map((p) => p.id)).toEqual(expect.arrayContaining([aprobado.id, rechazado.id]));
    expect(new Set(todos.items.map((p) => p.estado)).size).toBeGreaterThan(1);
    expect(todos.total).toBe(await prisma.pago.count({ where: { usuario_id: usuarioId } }));
    expect(todos.total).toBeGreaterThan(porDefecto.total);

    // Un estado explícito devuelve solo ese: el aprobado no aparece entre los rechazados.
    expect(rechazados.items.map((p) => p.id)).toContain(rechazado.id);
    expect(rechazados.items.map((p) => p.id)).not.toContain(aprobado.id);
  });

  it('anular: APROBADO → ANULADO con reembolso; reanular es no-op (204)', async () => {
    const pago = await pagos.procesarPago({ concepto: conceptoSocio(), token: 'tok_aprobado_4' } as never, nuevaKey());

    await pagos.anularPago(pago.id);
    const fila = await prisma.pago.findUnique({ where: { id: pago.id } });
    expect(fila?.estado).toBe('ANULADO');

    // Reanular no rompe ni cambia nada.
    await expect(pagos.anularPago(pago.id)).resolves.toBeUndefined();
  });

  it('anular un RECHAZADO → 409 (nunca se cobró)', async () => {
    const key = nuevaKey();
    await expect(pagos.procesarPago({ concepto: conceptoSocio(), token: 'tok_rechazado' } as never, key)).rejects.toBeInstanceOf(
      ProblemException,
    );
    const fila = await prisma.pago.findUniqueOrThrow({ where: { idempotencia_key: key } });

    await expect(pagos.anularPago(fila.id)).rejects.toBeInstanceOf(ProblemException);
  });

  it('comprobante: un APROBADO baja los bytes; un pago no aprobado → 409', async () => {
    const aprobado = await pagos.procesarPago({ concepto: conceptoSocio(), token: 'tok_aprobado_5' } as never, nuevaKey());
    const comprobante = await pagos.obtenerComprobante(aprobado.id);
    expect(comprobante.nombre).toBe(`comprobante-pago-${aprobado.id}.pdf`);
    expect(comprobante.buffer.length).toBeGreaterThan(0);

    const pendiente = await pagos.procesarPago({ concepto: conceptoSocio(), token: 'tok_pendiente_2' } as never, nuevaKey());
    await expect(pagos.obtenerComprobante(pendiente.id)).rejects.toBeInstanceOf(ProblemException);
  });

  it('404 si el concepto no existe', async () => {
    await expect(
      pagos.procesarPago({ concepto: { tipo: 'MEMBRESIA', membresiaId: 99999999 }, token: 'tok_aprobado' } as never, nuevaKey()),
    ).rejects.toBeInstanceOf(ProblemException);
  });
});
