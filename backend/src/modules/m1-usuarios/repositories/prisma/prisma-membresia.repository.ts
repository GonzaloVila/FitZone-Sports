import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../commons/database/prisma.service';
import {
  calcularVigencia,
  Membresia,
  MembresiaNueva,
} from '../../entities/membresia.entity';
import { MembresiaRepository } from '../membresia.repository';

type MembresiaRow = Prisma.MembresiaGetPayload<Record<string, never>>;

@Injectable()
export class PrismaMembresiaRepository implements MembresiaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(membresia: MembresiaNueva): Promise<Membresia> {
    const { fecha_inicio, fecha_fin } = calcularVigencia(
      membresia.plan,
      membresia.fecha_inicio ?? new Date(),
    );

    const fila = await this.prisma.membresia.create({
      data: {
        socio_id: membresia.socio_id,
        plan: membresia.plan,
        estado: 'ACTIVA',
        fecha_inicio,
        fecha_fin,
        renueva_automatica: membresia.renueva_automatica ?? false,
      },
    });

    return this.aDominio(fila);
  }

  async buscarPorSocioId(socioId: number): Promise<Membresia | null> {
    const fila = await this.prisma.membresia.findUnique({
      where: { socio_id: socioId },
    });
    return fila ? this.aDominio(fila) : null;
  }

  private aDominio(fila: MembresiaRow): Membresia {
    return {
      id: fila.id,
      socio_id: fila.socio_id,
      plan: fila.plan,
      estado: fila.estado,
      fecha_inicio: fila.fecha_inicio,
      fecha_fin: fila.fecha_fin,
      renueva_automatica: fila.renueva_automatica,
    };
  }
}
