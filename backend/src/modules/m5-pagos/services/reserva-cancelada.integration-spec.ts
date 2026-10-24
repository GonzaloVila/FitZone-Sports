import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { CanchasModule } from 'src/modules/m4-canchas/canchas.module';
import { CanchasService } from 'src/modules/m4-canchas/services/canchas.service';
import { ReservasCanchasService } from 'src/modules/m4-canchas/services/reservas-canchas.service';
import { PagosModule } from 'src/modules/m5-pagos/pagos.module';
import { PagosService } from 'src/modules/m5-pagos/services/pagos.service';
import { crearSede, crearUsuario } from '@test/helpers/base-de-datos';
import { crearModuloDeIntegracion } from '@test/helpers/modulo-de-integracion';

// Integration cruzada M4 -> M5: cancelar una reserva de cancha pagada emite el evento
// y el listener de M5 anula el pago (devolución incluida) contra la BD real.
describe('Cancelar reserva de cancha pagada (integration M4 -> M5)', () => {
  const INICIO = '2026-12-03T17:00:00.000Z';
  const FIN = '2026-12-03T18:00:00.000Z';

  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let reservas: ReservasCanchasService;
  let canchas: CanchasService;
  let pagos: PagosService;
  let sedeId: number;
  let usuarioId: number;

  beforeAll(async () => {
    moduleRef = await crearModuloDeIntegracion(CanchasModule, PagosModule);
    // Sin init() no corre onApplicationBootstrap, que es donde el EventEmitter
    // suscribe los @OnEvent: el evento se emitiría sin oyentes.
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    reservas = moduleRef.get(ReservasCanchasService);
    canchas = moduleRef.get(CanchasService);
    pagos = moduleRef.get(PagosService);
    sedeId = await crearSede(prisma);
    usuarioId = await crearUsuario(prisma, 'EXTERNO');
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

  it('al cancelar la reserva, el pago APROBADO queda ANULADO', async () => {
    const cancha = await canchas.crear(sedeId, { tipo: 'FUTBOL5', costoPorHora: 10000 } as never);
    const reserva = await reservas.crear({
      canchaId: cancha.id,
      usuarioId,
      fechaHoraInicio: INICIO,
      fechaHoraFin: FIN,
    } as never);

    const pago = await pagos.procesarPago(
      { concepto: { tipo: 'RESERVA_CANCHA', reservaCanchaId: reserva.id }, token: 'tok_aprobado_1' } as never,
      `it-cancelacion-${Date.now()}`,
    );
    expect(pago.estado).toBe('APROBADO');

    await reservas.cancelar(reserva.id);

    const fila = await prisma.pago.findUnique({ where: { id: pago.id } });
    expect(fila?.estado).toBe('ANULADO');
  });
});
