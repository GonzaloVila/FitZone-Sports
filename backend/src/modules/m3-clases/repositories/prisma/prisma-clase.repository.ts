import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../commons/database/prisma.service';
import type { Clase, ClaseConCupo, ClaseNueva } from '../../entities/clase.entity';
import type { ClaseFiltros, ClaseRepository } from '../clase.repository';

@Injectable()
export class PrismaClaseRepository implements ClaseRepository {
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

  async listar(filtros?: ClaseFiltros): Promise<ClaseConCupo[]> {
    const filas = await this.prisma.clase.findMany({
      where: {
        ...(filtros?.sede_id ? { sede_id: filtros.sede_id } : {}),
        ...(filtros?.tipo ? { tipo: { contains: filtros.tipo, mode: 'insensitive' } } : {}),
        ...(filtros?.fecha ? { horario: { startsWith: filtros.fecha } } : {}),
      },
      include: {
        _count: {
          select: {
            reservas: { where: { estado: 'CONFIRMADA' } },
          },
        },
      },
      orderBy: { horario: 'asc' },
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
