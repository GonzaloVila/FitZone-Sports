import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import type { Clase, ClaseConCupo, ClaseNueva, EstadoClase } from '../entities/clase.entity';

export interface ClaseFiltros {
  sedeId?: number;
  tipo?: string;
  estado?: EstadoClase;
  // El "ahora" contra el que se deriva el estado; por defecto, el instante de la consulta.
  ahora?: Date;
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
        horario_inicio: clase.horarioInicio,
        horario_fin: clase.horarioFin,
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
    { sedeId, tipo, estado, ahora = new Date() }: ClaseFiltros,
    { page, perPage }: OpcionesPaginacion,
  ): Promise<{ items: ClaseConCupo[]; total: number }> {
    const where: Prisma.ClaseWhereInput = {
      ...(sedeId !== undefined && { sede_id: sedeId }),
      ...(tipo !== undefined && { tipo: { contains: tipo, mode: 'insensitive' } }),
      ...(estado !== undefined && (await this.filtroDeEstado(estado, ahora))),
    };

    const [filas, total] = await Promise.all([
      this.prisma.clase.findMany({
        where,
        include: {
          _count: {
            select: {
              reservas: { where: { estado: 'CONFIRMADA' } },
            },
          },
        },
        orderBy: { horario_inicio: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.clase.count({ where }),
    ]);

    const items = filas.map((fila) => {
      const reservasConfirmadas = fila._count.reservas;
      return {
        ...this.aDominio(fila),
        reservasConfirmadas: reservasConfirmadas,
        cupoDisponible: Math.max(0, fila.capacidad - reservasConfirmadas),
      };
    });

    return { items, total };
  }

  // El estado no es una columna: se arma con el mismo criterio que el listado (empezó = horario_inicio <= ahora; sin cupos =
  // reservas CONFIRMADAS >= capacidad). Prisma no compara una columna contra un conteo, así que los ids de las futuras con el
  // cupo agotado salen de una consulta y se aplican como `in` / `notIn`: el filtro queda dentro del `where` y el total y la
  // paginación son los del conjunto filtrado.
  private async filtroDeEstado(estado: EstadoClase, ahora: Date): Promise<Prisma.ClaseWhereInput> {
    if (estado === 'COMENZADA') return { horario_inicio: { lte: ahora } };

    const agotadas = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT c."id" FROM "Clase" c
      WHERE c."horario_inicio" > ${ahora}
        AND c."capacidad" <= (
          SELECT COUNT(*) FROM "ReservaClase" r WHERE r."clase_id" = c."id" AND r."estado" = 'CONFIRMADA'
        )
    `;
    const ids = agotadas.map((fila) => fila.id);
    return {
      horario_inicio: { gt: ahora },
      id: estado === 'SIN_CUPOS' ? { in: ids } : { notIn: ids },
    };
  }

  private aDominio(fila: Prisma.ClaseGetPayload<Record<string, never>>): Clase {
    return {
      id: fila.id,
      sedeId: fila.sede_id,
      tipo: fila.tipo,
      instructor: fila.instructor,
      horarioInicio: fila.horario_inicio,
      horarioFin: fila.horario_fin,
      capacidad: fila.capacidad,
    };
  }
}
