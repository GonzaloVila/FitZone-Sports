import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import { mapearErrorPrisma } from '../../../commons/errors/prisma.mapper';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import type {
  EstadoReservaClase,
  ReservaClase,
} from '../entities/reserva-clase.entity';

export interface FiltrosReservasClase {
  claseId?: number;
  socioId?: number;
  estado?: EstadoReservaClase;
}

export type MotivoFalloReserva = 'CUPO_AGOTADO' | 'RESERVA_DUPLICADA' | 'CLASE_INEXISTENTE';

export type ResultadoCrearReserva =
  | { ok: true; reserva: ReservaClase }
  | { ok: false; motivo: MotivoFalloReserva };

// Capa de acceso a datos de la reserva de clase. Es la unica pieza de M3 que
// conoce Prisma, y la unica que puede decidir el cupo con el lock de la clase.
@Injectable()
export class ReservaClaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    { claseId, socioId, estado }: FiltrosReservasClase,
    { page, perPage }: OpcionesPaginacion,
  ): Promise<ReservaClase[]> {
    const where: Prisma.ReservaClaseWhereInput = {
      ...(claseId !== undefined && { clase_id: claseId }),
      ...(socioId !== undefined && { socio_id: socioId }),
      ...(estado !== undefined && { estado }),
    };

    const filas = await this.prisma.reservaClase.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { id: 'asc' },
    });

    return filas.map((fila) => this.aDominio(fila));
  }

  async crearConLock(claseId: number, socioId: number): Promise<ResultadoCrearReserva> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Lock pesimista sobre la fila de Clase (serializa reservas concurrentes)
        const filasClase = await tx.$queryRaw<{ capacidad: number }[]>`
          SELECT "capacidad" FROM "Clase" WHERE "id" = ${claseId} FOR UPDATE
        `;
        const clase = filasClase[0];
        if (!clase) {
          return { ok: false as const, motivo: 'CLASE_INEXISTENTE' as const };
        }

        // Conteo de reservas confirmadas activas
        const reservasConfirmadas = await tx.reservaClase.count({
          where: { clase_id: claseId, estado: 'CONFIRMADA' },
        });

        if (reservasConfirmadas >= clase.capacidad) {
          return { ok: false as const, motivo: 'CUPO_AGOTADO' as const };
        }

        // Comprobación de reserva previa activa para el mismo socio
        const yaTieneReserva = await tx.reservaClase.findFirst({
          where: { clase_id: claseId, socio_id: socioId, estado: 'CONFIRMADA' },
        });

        if (yaTieneReserva) {
          return { ok: false as const, motivo: 'RESERVA_DUPLICADA' as const };
        }

        const fila = await tx.reservaClase.create({
          data: {
            clase_id: claseId,
            socio_id: socioId,
            estado: 'CONFIRMADA',
          },
        });

        return {
          ok: true as const,
          reserva: this.aDominio(fila),
        };
      });
    } catch (error) {
      // Si el motor captura una colisión única simultánea mediante unq_reserva_clase_socio_activa
      if (mapearErrorPrisma(error) === 'UNIQUE') {
        return { ok: false as const, motivo: 'RESERVA_DUPLICADA' as const };
      }
      throw error;
    }
  }

  async buscarPorId(id: number): Promise<ReservaClase | null> {
    const fila = await this.prisma.reservaClase.findUnique({ where: { id } });
    return fila ? this.aDominio(fila) : null;
  }

  async buscarActivaPorClaseYSocio(claseId: number, socioId: number): Promise<ReservaClase | null> {
    const fila = await this.prisma.reservaClase.findFirst({
      where: { clase_id: claseId, socio_id: socioId, estado: 'CONFIRMADA' },
    });
    return fila ? this.aDominio(fila) : null;
  }

  async marcarCancelada(id: number): Promise<ReservaClase | null> {
    try {
      const fila = await this.prisma.reservaClase.update({
        where: { id },
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

  async contarConfirmadasPorClase(claseId: number): Promise<number> {
    return this.prisma.reservaClase.count({
      where: { clase_id: claseId, estado: 'CONFIRMADA' },
    });
  }

  private aDominio(fila: Prisma.ReservaClaseGetPayload<Record<string, never>>): ReservaClase {
    return {
      id: fila.id,
      claseId: fila.clase_id,
      socioId: fila.socio_id,
      estado: fila.estado as 'CONFIRMADA' | 'CANCELADA',
    };
  }
}
