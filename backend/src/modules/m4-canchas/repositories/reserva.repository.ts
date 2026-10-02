import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import type { Reserva } from '../entities/reserva.entity';

export interface ReservaNueva {
  cancha_id: number;
  usuario_id: number;
  fecha_hora_inicio: Date;
  fecha_hora_fin: Date;
  precio_aplicado: number;
}

// Resultado discriminado: el solapamiento (RN-02) solo es detectable en la
// base, por la constraint exq_reserva_turno; este repositorio lo traduce a este
// motivo y el service decide el 409 (mismo criterio que ResultadoCrearIngreso en M2).
export type ResultadoCrearReserva =
  | { ok: true; reserva: Reserva }
  | { ok: false; motivo: 'TURNO_OCUPADO' };

// Lista blanca de filtros: solo filtra por los campos presentes. El repositorio
// no decide defaults (p. ej. el estado): eso es regla de negocio del service.
// desde/hasta acotan fecha_hora_inicio como [desde, hasta).
export interface FiltrosListarReservas {
  canchaId?: number;
  usuarioId?: number;
  estado?: 'CONFIRMADA' | 'CANCELADA';
  desde?: Date;
  hasta?: Date;
  page: number;
  perPage: number;
}

type ReservaRow = Prisma.ReservaGetPayload<Record<string, never>>;

const CONSTRAINT_TURNO = 'exq_reserva_turno';

// Capa de acceso a datos de la reserva de cancha. Es la unica pieza de M4 que
// conoce Prisma y la unica que puede detectar el solapamiento por constraint.
@Injectable()
export class ReservaRepository {
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

  async listar({ canchaId, usuarioId, estado, desde, hasta, page, perPage }: FiltrosListarReservas): Promise<Reserva[]> {
    // Solo filtra por lo que viene; no aplica defaults (el del estado es del service).
    const filas = await this.prisma.reserva.findMany({
      where: {
        ...(canchaId !== undefined && { cancha_id: canchaId }),
        ...(usuarioId !== undefined && { usuario_id: usuarioId }),
        ...(estado !== undefined && { estado }),
        ...((desde !== undefined || hasta !== undefined) && {
          fecha_hora_inicio: {
            ...(desde !== undefined && { gte: desde }),
            ...(hasta !== undefined && { lt: hasta }),
          },
        }),
      },
      skip: (page - 1) * perPage,
      take: perPage,
      // El id desempata para que la paginación no repita ni pierda filas entre
      // reservas con el mismo inicio (distintas canchas).
      orderBy: [{ fecha_hora_inicio: 'desc' }, { id: 'desc' }],
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
