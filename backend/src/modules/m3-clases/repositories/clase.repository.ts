import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import type { Clase, ClaseConCupo, ClaseNueva } from '../entities/clase.entity';

export interface ClaseFiltros {
  sedeId?: number;
  tipo?: string;
}

// Capa de acceso a datos de la clase. Es la unica pieza de M3 que conoce Prisma.
@Injectable()
export class ClaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(clase: ClaseNueva): Promise<Clase> {
    const fila = await this.prisma.clase.create({
      data: {
        sede_id: clase.sedeId,
        tipo: clase.tipo,
        instructor: clase.instructor,
        horario: clase.horario,
        capacidad: clase.capacidad,
      },
    });

    return this.aDominio(fila);
  }

  async buscarPorId(id: number): Promise<ClaseConCupo | null> {
    const fila = await this.prisma.clase.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            reservas: { where: { estado: 'CONFIRMADA' } },
          },
        },
      },
    });

    if (!fila) {
      return null;
    }

    const reservasConfirmadas = fila._count.reservas;
    return {
      ...this.aDominio(fila),
      reservasConfirmadas: reservasConfirmadas,
      cupoDisponible: Math.max(0, fila.capacidad - reservasConfirmadas),
    };
  }

  async listar(
    { sedeId, tipo }: ClaseFiltros,
    { page, perPage }: OpcionesPaginacion,
  ): Promise<ClaseConCupo[]> {
    const where: Prisma.ClaseWhereInput = {
      ...(sedeId !== undefined && { sede_id: sedeId }),
      ...(tipo !== undefined && { tipo: { contains: tipo, mode: 'insensitive' } }),
    };

    const filas = await this.prisma.clase.findMany({
      where,
      include: {
        _count: {
          select: {
            reservas: { where: { estado: 'CONFIRMADA' } },
          },
        },
      },
      orderBy: { horario: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    return filas.map((fila) => {
      const reservasConfirmadas = fila._count.reservas;
      return {
        ...this.aDominio(fila),
        reservasConfirmadas: reservasConfirmadas,
        cupoDisponible: Math.max(0, fila.capacidad - reservasConfirmadas),
      };
    });
  }

  private aDominio(fila: Prisma.ClaseGetPayload<Record<string, never>>): Clase {
    return {
      id: fila.id,
      sedeId: fila.sede_id,
      tipo: fila.tipo,
      instructor: fila.instructor,
      horario: fila.horario,
      capacidad: fila.capacidad,
    };
  }
}
