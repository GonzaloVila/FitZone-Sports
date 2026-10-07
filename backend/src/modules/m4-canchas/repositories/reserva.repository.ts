import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import { mapearErrorPrisma } from '../../../commons/errors/prisma.mapper';
import {
  ReservaRepository,
  type FiltrosListarReservas,
  type ReservaNueva,
  type ResultadoCrearReserva,
} from '../domain/reserva.port';
import type { Reserva } from '../entities/reserva.entity';

type ReservaRow = Prisma.ReservaGetPayload<Record<string, never>>;

// Adaptador de Prisma del puerto ReservaRepository. Es la unica pieza de M4 que
// conoce Prisma y la unica que traduce el solapamiento (la constraint de
// exclusion) al motivo del resultado discriminado.
@Injectable()
export class PrismaReservaRepository extends ReservaRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

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
      // La constraint de exclusion de RN-02 (23P01) no la modela Prisma: el mapper
      // la reconoce y la sube a la causa EXCLUSION. Acá se baja al motivo del
      // resultado; el service lo traduce al 409 turno-ocupado.
      if (mapearErrorPrisma(error) === 'EXCLUSION') {
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
      if (mapearErrorPrisma(error) === 'NO_ENCONTRADO') {
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
