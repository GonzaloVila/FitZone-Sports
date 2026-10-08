import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import type { Sede, SedeNueva } from '../entities/sede.entity';

type SedeRow = Prisma.SedeGetPayload<Record<string, never>>;

// Capa de acceso a datos de la sede. Es la unica pieza de M2 que conoce Prisma:
// los services de arriba reciben el tipo `Sede`, nunca una fila de Prisma.
@Injectable()
export class SedeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar({ page, perPage }: OpcionesPaginacion): Promise<Sede[]> {
    const filas = await this.prisma.sede.findMany({
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { id: 'asc' },
    });
    return filas.map((fila) => this.aDominio(fila));
  }

  async crear(sede: SedeNueva): Promise<Sede> {
    const fila = await this.prisma.sede.create({
      data: {
        nombre: sede.nombre,
        direccion: sede.direccion,
        aforo_maximo: sede.aforoMaximo,
      },
    });
    return this.aDominio(fila);
  }

  async buscarPorId(id: number): Promise<Sede | null> {
    const fila = await this.prisma.sede.findUnique({ where: { id } });
    return fila ? this.aDominio(fila) : null;
  }

  private aDominio(fila: SedeRow): Sede {
    return {
      id: fila.id,
      nombre: fila.nombre,
      direccion: fila.direccion,
      aforoMaximo: fila.aforo_maximo,
    };
  }
}
