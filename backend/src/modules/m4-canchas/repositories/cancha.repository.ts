import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import { mapearErrorPrisma } from '../../../commons/errors/prisma.mapper';
import type { Cancha } from '../entities/cancha.entity';

export interface OpcionesListadoCanchas {
  estado?: 'OPERATIVA' | 'EN_MANTENIMIENTO';
  page: number;
  perPage: number;
}

export interface FiltrosBusquedaCanchas extends OpcionesListadoCanchas {
  sedeId?: number;
  tipo?: 'PADDLE' | 'FUTBOL5';
}

export interface CanchaNueva {
  sedeId: number;
  tipo: 'PADDLE' | 'FUTBOL5';
  costoPorHora: number;
  estado?: 'OPERATIVA' | 'EN_MANTENIMIENTO';
}

export interface CanchaActualizable {
  costoPorHora?: number;
  estado?: 'OPERATIVA' | 'EN_MANTENIMIENTO';
}

type CanchaRow = Prisma.CanchaGetPayload<Record<string, never>>;

// Capa de acceso a datos de la cancha. Es la unica pieza de M4 que conoce Prisma.
@Injectable()
export class CanchaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorSede(sedeId: number, { estado, page, perPage }: OpcionesListadoCanchas): Promise<{ items: Cancha[]; total: number }> {
    return this.paginar(
      {
        sede_id: sedeId,
        ...(estado && { estado }),
      },
      page,
      perPage,
    );
  }

  // Listado de todas las sedes (GET /canchas): cada filtro es opcional y se combinan
  // con AND. Sin filtros trae todas las canchas de la cadena.
  async buscar({ sedeId, tipo, estado, page, perPage }: FiltrosBusquedaCanchas): Promise<{ items: Cancha[]; total: number }> {
    return this.paginar(
      {
        ...(sedeId !== undefined && { sede_id: sedeId }),
        ...(tipo && { tipo }),
        ...(estado && { estado }),
      },
      page,
      perPage,
    );
  }

  // Orden estable por sede y luego por id: dentro de una sola sede equivale a `id asc`,
  // asi que listarPorSede conserva su orden de siempre.
  private async paginar(where: Prisma.CanchaWhereInput, page: number, perPage: number): Promise<{ items: Cancha[]; total: number }> {
    const [filas, total] = await Promise.all([
      this.prisma.cancha.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: [{ sede_id: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.cancha.count({ where }),
    ]);
    return {
      items: filas.map((fila) => this.aDominio(fila)),
      total,
    };
  }

  async crear(cancha: CanchaNueva): Promise<Cancha> {
    const fila = await this.prisma.cancha.create({
      data: {
        sede_id: cancha.sedeId,
        tipo: cancha.tipo,
        costo_por_hora: cancha.costoPorHora,
        estado: cancha.estado ?? 'OPERATIVA',
      },
    });
    return this.aDominio(fila);
  }

  async buscarPorId(id: number): Promise<Cancha | null> {
    const fila = await this.prisma.cancha.findUnique({ where: { id } });
    return fila ? this.aDominio(fila) : null;
  }

  async actualizar(id: number, cambios: CanchaActualizable): Promise<Cancha | null> {
    try {
      const fila = await this.prisma.cancha.update({
        where: { id },
        data: {
          ...(cambios.costoPorHora !== undefined && { costo_por_hora: cambios.costoPorHora }),
          ...(cambios.estado !== undefined && { estado: cambios.estado }),
        },
      });
      return this.aDominio(fila);
    } catch (error) {
      if (mapearErrorPrisma(error) === 'NO_ENCONTRADO') {
        return null;
      }
      throw error;
    }
  }

  private aDominio(fila: CanchaRow): Cancha {
    return {
      id: fila.id,
      sedeId: fila.sede_id,
      tipo: fila.tipo,
      costoPorHora: fila.costo_por_hora.toNumber(),
      estado: fila.estado,
    };
  }
}
