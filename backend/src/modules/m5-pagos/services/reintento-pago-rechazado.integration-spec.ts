import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { ProblemException } from 'src/commons/filters/problem.exception';
import { CanchasModule } from 'src/modules/m4-canchas/canchas.module';
import { CanchasService } from 'src/modules/m4-canchas/services/canchas.service';
import { ReservasCanchasService } from 'src/modules/m4-canchas/services/reservas-canchas.service';
import { PagosModule } from 'src/modules/m5-pagos/pagos.module';
import { PagosService } from 'src/modules/m5-pagos/services/pagos.service';
import { crearSede, crearUsuario } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

// Integration: una reserva con un pago RECHAZADO se puede volver a pagar con otra clave.
// `PagoReserva.reserva_id` es @unique (una fila de pago por reserva), así que el segundo
// intento reutiliza la fila RECHAZADA en lugar de chocar con el unique.
describe('Reintento de pago tras un rechazo (integration, BD real)', () => {
  const INICIO = '2026-12-05T17:00:00.000Z';
  const FIN = '2026-12-05T18:00:00.000Z';
  const sufijo = `${Date.now()}`;
  const claveA = `it-reintento-${sufijo}-A`;
  const claveB = `it-reintento-${sufijo}-B`;
  const claveC = `it-reintento-${sufijo}-C`;

  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let pagos: PagosService;
  let sedeId: number;
  let usuarioId: number;
  let reservaId: number;
  let idDelIntentoRechazado: number;

  const cobrar = (token: string, clave: string) =>
    pagos.procesarPago({ concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: reservaId }, token } as never, clave);

  // Lo que lanza el service, para mirar el status y el `type` del problem+json.
  async function fallo(promesa: Promise<unknown>): Promise<ProblemException> {
    const error = await promesa.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ProblemException);
    return error as ProblemException;
  }

  beforeAll(async () => {
    // Si estuviera seteado, la pasarela ignoraría el token y este escenario no funcionaría.
    delete process.env.PASARELA_MOCK;

    moduleRef = await crearModuloDeIntegracion(CanchasModule, PagosModule);
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    pagos = moduleRef.get(PagosService);
    const canchas = moduleRef.get(CanchasService);
    const reservas = moduleRef.get(ReservasCanchasService);
    sedeId = await crearSede(prisma);
    usuarioId = await crearUsuario(prisma, 'EXTERNO');

    const cancha = await canchas.crear(sedeId, { tipo: 'FUTBOL5', costoPorHora: 10000 } as never);
    const reserva = await reservas.crear({
      canchaId: cancha.id,
      usuarioId,
      fechaHoraInicio: INICIO,
      fechaHoraFin: FIN,
    } as never);
    reservaId = reserva.id;
  });

  afterAll(async () => {
    const reservasDelUsuario = await prisma.reserva.findMany({
      where: { usuario_id: usuarioId },
      select: { id: true },
    });
    await prisma.pagoReserva.deleteMany({
      where: { reserva_id: { in: reservasDelUsuario.map((r) => r.id) } },
    });
    await prisma.pago.deleteMany({ where: { usuario_id: usuarioId } });
    await prisma.reserva.deleteMany({ where: { usuario_id: usuarioId } });
    await prisma.cancha.deleteMany({ where: { sede_id: sedeId } });
    await prisma.usuario.delete({ where: { id: usuarioId } });
    await prisma.sede.delete({ where: { id: sedeId } });
    await moduleRef.close();
  });

  // Los casos van en orden: cada uno parte de lo que dejó el anterior.
  it('1. el primer intento con un token rechazado responde 402 y queda RECHAZADO', async () => {
    const error = await fallo(cobrar('tok_rechazado', claveA));

    expect(error.getStatus()).toBe(402);
    const fila = await prisma.pago.findUnique({ where: { idempotencia_key: claveA } });
    expect(fila?.estado).toBe('RECHAZADO');
    idDelIntentoRechazado = fila!.id;
  });

  it('2. pagar la misma reserva con otra clave reutiliza la fila y queda APROBADO con comprobante', async () => {
    const pago = await cobrar('tok_aprobado_1', claveB);

    expect(pago.estado).toBe('APROBADO');
    expect(pago.comprobantePdfUrl).toBeTruthy();
    expect(pago.id).toBe(idDelIntentoRechazado);

    const filas = await prisma.pago.findMany({ where: { pago_reserva: { reserva_id: reservaId } } });
    expect(filas).toHaveLength(1);
    expect(filas[0]?.idempotencia_key).toBe(claveB);
    expect(filas[0]?.estado).toBe('APROBADO');
  });

  it('3. pagar de nuevo la reserva ya cobrada con otra clave responde 409 de reserva ya cobrada', async () => {
    const error = await fallo(cobrar('tok_aprobado_1', claveC));

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({ type: 'about:blank', title: 'La reserva ya fue cobrada' });
  });

  it('4. repetir la clave del cobro aprobado responde 409 de idempotencia repetida y no cobra de nuevo', async () => {
    const error = await fallo(cobrar('tok_aprobado_1', claveB));

    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({ type: 'https://fitzone.app/errores/idempotencia-repetida' });
    const filas = await prisma.pago.findMany({ where: { pago_reserva: { reserva_id: reservaId } } });
    expect(filas).toHaveLength(1);
  });
});
