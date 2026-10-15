import { describe, expect, it } from 'vitest';
import type { ProblemException } from 'src/commons/filters/problem.exception';
import type { MembresiasService } from 'src/modules/m1-usuarios/services/membresias.service';
import {
  ReservaRepository,
  type FiltrosListarReservas,
  type ReservaNueva,
  type ResultadoCrearReserva,
} from 'src/modules/m4-canchas/domain/reserva.port';
import type { Reserva } from 'src/modules/m4-canchas/entities/reserva.entity';
import { DescuentoSocio } from 'src/modules/m4-canchas/pricing/descuento-socio.regla';
import { RecargoHorarioPico } from 'src/modules/m4-canchas/pricing/recargo-horario-pico.regla';
import { TarifadorDePrecios } from 'src/modules/m4-canchas/pricing/tarifador-de-precios';
import type { CanchaRepository } from 'src/modules/m4-canchas/repositories/cancha.repository';
import { ReservasCanchasService } from 'src/modules/m4-canchas/services/reservas-canchas.service';
import { CanchaExiste } from 'src/modules/m4-canchas/validaciones/cancha-existe.validacion';
import { CanchaOperativa } from 'src/modules/m4-canchas/validaciones/cancha-operativa.validacion';
import { RangoHorarioValido } from 'src/modules/m4-canchas/validaciones/rango-horario-valido.validacion';
import { ValidadorDeReservasCancha } from 'src/modules/m4-canchas/validaciones/validador-de-reservas-cancha';

// Repositorio de dominio en memoria (Fowler): el caso de uso se prueba sin Prisma
// ni contenedor. La exclusion RN-02 se modela acá con el mismo criterio que la
// constraint de la base: dos reservas CONFIRMADA que solapan -> TURNO_OCUPADO.
class ReservaEnMemoria extends ReservaRepository {
  private readonly filas = new Map<number, Reserva>();
  private secuencia = 0;

  async crear(r: ReservaNueva): Promise<ResultadoCrearReserva> {
    const solapa = [...this.filas.values()].some(
      (x) =>
        x.estado === 'CONFIRMADA' &&
        x.canchaId === r.canchaId &&
        r.fechaHoraInicio < x.fechaHoraFin &&
        r.fechaHoraFin > x.fechaHoraInicio,
    );
    if (solapa) {
      return { ok: false, motivo: 'TURNO_OCUPADO' };
    }
    const reserva: Reserva = { id: ++this.secuencia, ...r, estado: 'CONFIRMADA' };
    this.filas.set(reserva.id, reserva);
    return { ok: true, reserva };
  }

  async buscarPorId(id: number): Promise<Reserva | null> {
    return this.filas.get(id) ?? null;
  }

  async cancelar(id: number): Promise<Reserva | null> {
    const actual = this.filas.get(id);
    if (!actual || actual.estado === 'CANCELADA') {
      return null;
    }
    const cancelada: Reserva = { ...actual, estado: 'CANCELADA' };
    this.filas.set(id, cancelada);
    return cancelada;
  }

  async listarOcupadasEnRango(canchaId: number, desde: Date, hasta: Date): Promise<Reserva[]> {
    return [...this.filas.values()].filter(
      (x) =>
        x.canchaId === canchaId &&
        x.estado === 'CONFIRMADA' &&
        x.fechaHoraInicio < hasta &&
        x.fechaHoraFin > desde,
    );
  }

  async listar(_filtros: FiltrosListarReservas): Promise<Reserva[]> {
    return [...this.filas.values()];
  }
}

const canchaOperativa = {
  id: 1,
  sedeId: 1,
  tipo: 'FUTBOL5' as const,
  costoPorHora: 5000,
  estado: 'OPERATIVA' as const,
};

function armar() {
  const repo = new ReservaEnMemoria();
  const canchas = {
    buscarPorId: async (id: number) => (id === canchaOperativa.id ? canchaOperativa : null),
  } as unknown as CanchaRepository;
  const membresias = {
    consultarVigencia: async () => ({ vigente: false }),
  } as unknown as MembresiasService;
  const validador = new ValidadorDeReservasCancha([
    new CanchaExiste(),
    new CanchaOperativa(),
    new RangoHorarioValido(),
  ]);
  const service = new ReservasCanchasService(
    repo,
    canchas,
    membresias,
    new TarifadorDePrecios([new DescuentoSocio(), new RecargoHorarioPico()]),
    validador,
  );
  return { service, repo };
}

const reserva = (desde: string, hasta: string) => ({
  canchaId: 1,
  usuarioId: 9,
  fechaHoraInicio: desde,
  fechaHoraFin: hasta,
});

describe('ReservasCanchasService con repositorio en memoria (dominio sin base)', () => {
  it('crea la reserva y cotiza el precio de externo fuera de pico', async () => {
    const { service } = armar();

    const out = await service.crear(
      reserva('2026-11-20T14:00:00-03:00', '2026-11-20T15:00:00-03:00') as never,
    );

    expect(out.id).toBe(1);
    expect(out.precioAplicado).toBe(5000);
    expect(out.estado).toBe('CONFIRMADA');
  });

  it('RN-02: un turno solapado responde turnoOcupado (409), sin tocar la base', async () => {
    const { service } = armar();
    await service.crear(reserva('2026-11-20T14:00:00-03:00', '2026-11-20T15:00:00-03:00') as never);

    let capturado: ProblemException | undefined;
    try {
      await service.crear(
        reserva('2026-11-20T14:30:00-03:00', '2026-11-20T15:30:00-03:00') as never,
      );
    } catch (e) {
      capturado = e as ProblemException;
    }

    expect(capturado?.getStatus()).toBe(409);
    expect((capturado?.getResponse() as { type: string }).type).toBe(
      'https://fitzone.app/errores/turno-ocupado',
    );
  });

  it('cancelar libera el turno: otro solapado ya no choca', async () => {
    const { service } = armar();
    const primera = await service.crear(
      reserva('2026-11-20T14:00:00-03:00', '2026-11-20T15:00:00-03:00') as never,
    );

    await service.cancelar(primera.id);

    const segunda = await service.crear(
      reserva('2026-11-20T14:00:00-03:00', '2026-11-20T15:00:00-03:00') as never,
    );
    expect(segunda.id).toBe(2);
  });
});
