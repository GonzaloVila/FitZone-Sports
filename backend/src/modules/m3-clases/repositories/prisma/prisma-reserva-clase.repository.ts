import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../commons/database/prisma.service';
import type { ReservaClase } from '../../entities/reserva-clase.entity';
import type {
  ReservaClaseRepository,
  ResultadoCrearReserva,
} from '../reserva-clase.repository';

@Injectable()
export class PrismaReservaClaseRepository implements ReservaClaseRepository {
  constructor(private readonly prisma: PrismaService) {}

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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
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

  private aDominio(fila: {
    id: number;
    clase_id: number;
    socio_id: number;
    estado: string;
  }): ReservaClase {
    return {
      id: fila.id,
      clase_id: fila.clase_id,
      socio_id: fila.socio_id,
      estado: fila.estado as 'CONFIRMADA' | 'CANCELADA',
    };
  }
}
