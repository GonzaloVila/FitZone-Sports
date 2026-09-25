import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../commons/database/prisma.service';
import { Sede, SedeNueva } from '../../entities/sede.entity';
import { OpcionesPaginacion, SedeRepository } from '../sede.repository';

type SedeRow = Prisma.SedeGetPayload<Record<string, never>>;

@Injectable()
export class PrismaSedeRepository implements SedeRepository {
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
    const fila = await this.prisma.sede.create({ data: sede });
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
      aforo_maximo: fila.aforo_maximo,
    };
  }
}
