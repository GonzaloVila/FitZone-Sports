import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../commons/database/prisma.service';
import { Cancha } from '../../entities/cancha.entity';
import {
  CanchaActualizable,
  CanchaNueva,
  CanchaRepository,
  OpcionesListadoCanchas,
} from '../cancha.repository';

type CanchaRow = Prisma.CanchaGetPayload<Record<string, never>>;

@Injectable()
export class PrismaCanchaRepository implements CanchaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorSede(sedeId: number, { estado, page, perPage }: OpcionesListadoCanchas): Promise<Cancha[]> {
    const filas = await this.prisma.cancha.findMany({
      where: {
        sede_id: sedeId,
        ...(estado && { estado }),
      },
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { id: 'asc' },
    });
    return filas.map((fila) => this.aDominio(fila));
  }

  async crear(cancha: CanchaNueva): Promise<Cancha> {
    const fila = await this.prisma.cancha.create({
      data: {
        sede_id: cancha.sede_id,
        tipo: cancha.tipo,
        costo_por_hora: cancha.costo_por_hora,
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
          ...(cambios.costo_por_hora !== undefined && { costo_por_hora: cambios.costo_por_hora }),
          ...(cambios.estado !== undefined && { estado: cambios.estado }),
        },
      });
      return this.aDominio(fila);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  private aDominio(fila: CanchaRow): Cancha {
    return {
      id: fila.id,
      sede_id: fila.sede_id,
      tipo: fila.tipo,
      costo_por_hora: fila.costo_por_hora.toNumber(),
      estado: fila.estado,
    };
  }
}
