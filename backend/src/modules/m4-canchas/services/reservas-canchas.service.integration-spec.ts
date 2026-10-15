import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { SociosService } from 'src/modules/m1-usuarios/services/socios.service';
import { CanchasModule } from 'src/modules/m4-canchas/canchas.module';
import { CanchasService } from 'src/modules/m4-canchas/services/canchas.service';
import { ReservasCanchasService } from 'src/modules/m4-canchas/services/reservas-canchas.service';
import { crearSede, crearUsuario } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

// Horas en hora local de la sede (UTC-3). Pico = arranca en [19:00,21:00).
const NO_PICO_INICIO = '2026-12-02T17:00:00.000Z'; // 14:00 local
const NO_PICO_FIN = '2026-12-02T18:00:00.000Z';
const PICO_INICIO = '2026-12-02T22:30:00.000Z'; // 19:30 local
const PICO_FIN = '2026-12-02T23:30:00.000Z';
const PASADO_INICIO = '2026-01-02T17:00:00.000Z';
const PASADO_FIN = '2026-01-02T18:00:00.000Z';

// Integration: bootea CanchasModule (+ M1 por MembresiasService) contra la BD real.
// Cubre el pricing real (RN-03/RF-11), la exclusión de solapes (RN-02, constraint de
// la base) y el ciclo de cancelación con el estado derivado — todo lo que en e2e sobraba.
describe('M4 ReservasCanchasService (integration, BD real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let reservas: ReservasCanchasService;
  let canchas: CanchasService;
  let socios: SociosService;
  let sedeId: number;
  let usuarioExterno: number;
  let usuarioSocio: number;
  const canchasCreadas: number[] = [];
  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];

  beforeAll(async () => {
    moduleRef = await crearModuloDeIntegracion(CanchasModule);
    prisma = moduleRef.get(PrismaService);
    reservas = moduleRef.get(ReservasCanchasService);
    canchas = moduleRef.get(CanchasService);
    socios = moduleRef.get(SociosService);
    sedeId = await crearSede(prisma);

    usuarioExterno = await crearUsuario(prisma, 'EXTERNO');
    usuariosCreados.push(usuarioExterno);

    usuarioSocio = await crearUsuario(prisma, 'EXTERNO');
    usuariosCreados.push(usuarioSocio);
    const socio = await socios.crear({ usuarioId: usuarioSocio, sedeOrigenId: sedeId, plan: 'MENSUAL' } as never);
    sociosCreados.push(socio.id);
  });

  afterAll(async () => {
    await prisma.reserva.deleteMany({ where: { cancha_id: { in: canchasCreadas } } });
    await prisma.cancha.deleteMany({ where: { id: { in: canchasCreadas } } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.delete({ where: { id: sedeId } });
    await moduleRef.close();
  });

  async function nuevaCancha(costoPorHora = 10000): Promise<number> {
    const cancha = await canchas.crear(sedeId, { tipo: 'FUTBOL5', costoPorHora } as never);
    canchasCreadas.push(cancha.id);
    return cancha.id;
  }

  function reservar(canchaId: number, usuarioId: number, inicio: string, fin: string) {
    return reservas.crear({ canchaId, usuarioId, fechaHoraInicio: inicio, fechaHoraFin: fin } as never);
  }

  it('externo en horario no pico: precio base, sin descuento ni recargo', async () => {
    const canchaId = await nuevaCancha(10000);

    const reserva = await reservar(canchaId, usuarioExterno, NO_PICO_INICIO, NO_PICO_FIN);

    expect(reserva.precioAplicado).toBeCloseTo(10000, 2);
    const fila = await prisma.reserva.findUnique({ where: { id: reserva.id } });
    expect(Number(fila?.precio_aplicado)).toBeCloseTo(10000, 2);
  });

  it('socio con membresía vigente: 15% de descuento (RN-03)', async () => {
    const canchaId = await nuevaCancha(10000);

    const reserva = await reservar(canchaId, usuarioSocio, NO_PICO_INICIO, NO_PICO_FIN);

    expect(reserva.precioAplicado).toBeCloseTo(8500, 2);
  });

  it('horario pico (arranca 19:30): +20% (RF-11)', async () => {
    const canchaId = await nuevaCancha(10000);

    const reserva = await reservar(canchaId, usuarioExterno, PICO_INICIO, PICO_FIN);

    expect(reserva.precioAplicado).toBeCloseTo(12000, 2);
  });

  it('socio vigente en pico: acumula 15% off y 20% de recargo', async () => {
    const canchaId = await nuevaCancha(10000);

    const reserva = await reservar(canchaId, usuarioSocio, PICO_INICIO, PICO_FIN);

    expect(reserva.precioAplicado).toBeCloseTo(10200, 2); // 10000 * 0.85 * 1.20
  });

  it('RN-02: solape en la misma cancha → 409 (lo arbitra la constraint de exclusión)', async () => {
    const canchaId = await nuevaCancha(10000);
    await reservar(canchaId, usuarioExterno, NO_PICO_INICIO, NO_PICO_FIN);

    await expect(reservar(canchaId, usuarioExterno, NO_PICO_INICIO, NO_PICO_FIN)).rejects.toBeInstanceOf(
      ProblemException,
    );
  });

  it('listar default trae solo activas; CUMPLIDA trae las pasadas; CANCELADA las canceladas', async () => {
    const canchaId = await nuevaCancha(10000);
    const activa = await reservar(canchaId, usuarioExterno, NO_PICO_INICIO, NO_PICO_FIN);

    const pasada = await prisma.reserva.create({
      data: {
        cancha_id: canchaId,
        usuario_id: usuarioExterno,
        fecha_hora_inicio: new Date(PASADO_INICIO),
        fecha_hora_fin: new Date(PASADO_FIN),
        estado: 'CONFIRMADA',
        precio_aplicado: 10000,
      },
    });

    const porDefecto = await reservas.listar({ canchaId, page: 1, perPage: 100 });
    const idsDefecto = porDefecto.map((r) => r.id);
    expect(idsDefecto).toContain(activa.id);
    expect(idsDefecto).not.toContain(pasada.id);

    const cumplidas = await reservas.listar({ canchaId, estado: 'CUMPLIDA', page: 1, perPage: 100 });
    const idsCumplidas = cumplidas.map((r) => r.id);
    expect(idsCumplidas).toContain(pasada.id);
    expect(idsCumplidas).not.toContain(activa.id);
    expect(cumplidas.find((r) => r.id === pasada.id)?.estado).toBe('CUMPLIDA');
  });

  it('cancelar: pasa a CANCELADA, libera el horario y no vuelve a aparecer por defecto', async () => {
    const canchaId = await nuevaCancha(10000);
    const reserva = await reservar(canchaId, usuarioExterno, NO_PICO_INICIO, NO_PICO_FIN);

    await reservas.cancelar(reserva.id);

    const fila = await prisma.reserva.findUnique({ where: { id: reserva.id } });
    expect(fila?.estado).toBe('CANCELADA');

    const activas = await reservas.listar({ canchaId, page: 1, perPage: 100 });
    expect(activas.map((r) => r.id)).not.toContain(reserva.id);

    // El horario quedó libre: se puede reservar el mismo turno de nuevo.
    const reuso = await reservar(canchaId, usuarioExterno, NO_PICO_INICIO, NO_PICO_FIN);
    expect(reuso.id).not.toBe(reserva.id);
  });

  it('cancelar una reserva ya pasada → 409 reserva-pasada', async () => {
    const canchaId = await nuevaCancha(10000);
    const pasada = await prisma.reserva.create({
      data: {
        cancha_id: canchaId,
        usuario_id: usuarioExterno,
        fecha_hora_inicio: new Date(PASADO_INICIO),
        fecha_hora_fin: new Date(PASADO_FIN),
        estado: 'CONFIRMADA',
        precio_aplicado: 10000,
      },
    });

    await expect(reservas.cancelar(pasada.id)).rejects.toBeInstanceOf(ProblemException);
  });

  it('cancelar dos veces → 409 reserva-ya-cancelada', async () => {
    const canchaId = await nuevaCancha(10000);
    const reserva = await reservar(canchaId, usuarioExterno, NO_PICO_INICIO, NO_PICO_FIN);

    await reservas.cancelar(reserva.id);
    await expect(reservas.cancelar(reserva.id)).rejects.toBeInstanceOf(ProblemException);
  });
});
