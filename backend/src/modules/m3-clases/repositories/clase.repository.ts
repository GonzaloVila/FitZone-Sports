import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import type { Clase, ClaseConCupo, ClaseNueva } from '../entities/clase.entity';

export interface ClaseFiltros {
  sede_id?: number;
  tipo?: string;
}

// Capa de acceso a datos de la clase. Es la unica pieza de M3 que conoce Prisma.
@Injectable()
export class ClaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(clase: ClaseNueva): Promise<Clase> {
    const fila = await this.prisma.clase.create({
      data: {
        sede_id: clase.sede_id,
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
      reservas_confirmadas: reservasConfirmadas,
      cupo_disponible: Math.max(0, fila.capacidad - reservasConfirmadas),
    };
  }

  async listar(
    { sede_id, tipo }: ClaseFiltros,
    { page, perPage }: OpcionesPaginacion,
  ): Promise<ClaseConCupo[]> {
    const where: Prisma.ClaseWhereInput = {
      ...(sede_id !== undefined && { sede_id }),
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
        reservas_confirmadas: reservasConfirmadas,
        cupo_disponible: Math.max(0, fila.capacidad - reservasConfirmadas),
      };
    });
  }

  private aDominio(fila: {
    id: number;
    sede_id: number;
    tipo: string;
    instructor: string;
    horario: string;
    capacidad: number;
  }): Clase {
    return {
      id: fila.id,
      sede_id: fila.sede_id,
      tipo: fila.tipo,
      instructor: fila.instructor,
      horario: fila.horario,
      capacidad: fila.capacidad,
    };
  }
}
