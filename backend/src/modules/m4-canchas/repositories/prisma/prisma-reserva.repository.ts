import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../commons/database/prisma.service';
import { Reserva } from '../../entities/reserva.entity';
import { ReservaNueva, ReservaRepository, ResultadoCrearReserva } from '../reserva.repository';

type ReservaRow = Prisma.ReservaGetPayload<Record<string, never>>;

const CONSTRAINT_TURNO = 'exq_reserva_turno';

@Injectable()
export class PrismaReservaRepository implements ReservaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(reserva: ReservaNueva): Promise<ResultadoCrearReserva> {
    try {
      const fila = await this.prisma.$transaction((tx) =>
        tx.reserva.create({
          data: {
            cancha_id: reserva.cancha_id,
            usuario_id: reserva.usuario_id,
            fecha_hora_inicio: reserva.fecha_hora_inicio,
            fecha_hora_fin: reserva.fecha_hora_fin,
            estado: 'CONFIRMADA',
            precio_aplicado: reserva.precio_aplicado,
          },
        }),
      );
      return { ok: true, reserva: this.aDominio(fila) };
    } catch (error) {
      // exq_reserva_turno es una constraint de exclusión (23P01): Prisma no la
      // mapea, así que llega como PrismaClientUnknownRequestError con code
      // undefined y el nombre de la constraint solo en el mensaje. No sirve el
      // patrón `error.code === 'P2002'` de M2.
      if (
        error instanceof Prisma.PrismaClientUnknownRequestError &&
        error.message.includes(CONSTRAINT_TURNO)
      ) {
        return { ok: false, motivo: 'TURNO_OCUPADO' };
      }
      throw error;
    }
  }

  async buscarPorId(id: number): Promise<Reserva | null> {
    const fila = await this.prisma.reserva.findUnique({ where: { id } });
    return fila ? this.aDominio(fila) : null;
  }

  async cancelar(id: number): Promise<Reserva | null> {
    // El filtro por estado va en el WHERE del propio UPDATE (no en un
    // find previo): dos cancelaciones simultáneas no pueden ganar las dos.
    try {
      const fila = await this.prisma.reserva.update({
        where: { id, estado: { not: 'CANCELADA' } },
        data: { estado: 'CANCELADA' },
      });
      return this.aDominio(fila);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  async listarOcupadasEnRango(canchaId: number, desde: Date, hasta: Date): Promise<Reserva[]> {
    // Solapamiento con [desde, hasta): empieza antes de `hasta` y termina
    // después de `desde`. cancha_id + fecha_hora_inicio entran por
    // @@index([cancha_id, fecha_hora_inicio]); no se trae el histórico.
    const filas = await this.prisma.reserva.findMany({
      where: {
        cancha_id: canchaId,
        estado: { not: 'CANCELADA' },
        fecha_hora_inicio: { lt: hasta },
        fecha_hora_fin: { gt: desde },
      },
      orderBy: { fecha_hora_inicio: 'asc' },
    });
    return filas.map((fila) => this.aDominio(fila));
  }

  private aDominio(fila: ReservaRow): Reserva {
    return {
      id: fila.id,
      cancha_id: fila.cancha_id,
      usuario_id: fila.usuario_id,
      fecha_hora_inicio: fila.fecha_hora_inicio,
      fecha_hora_fin: fila.fecha_hora_fin,
      estado: fila.estado,
      precio_aplicado: fila.precio_aplicado.toNumber(),
    };
  }
}
