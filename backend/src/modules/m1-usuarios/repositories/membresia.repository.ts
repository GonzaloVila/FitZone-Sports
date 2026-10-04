import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import { calcularVigencia } from '../entities/membresia.entity';
import type {
  Membresia,
  MembresiaActualizable,
  MembresiaNoVigente,
} from '../entities/membresia.entity';

type MembresiaRow = Prisma.MembresiaGetPayload<Record<string, never>>;

// Capa de acceso a datos de la membresia. Es la unica pieza de M1 que conoce
// Prisma: los services de arriba reciben el tipo `Membresia`.
@Injectable()
export class MembresiaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorSocioId(socioId: number): Promise<Membresia | null> {
    const fila = await this.prisma.membresia.findUnique({
      where: { socio_id: socioId },
    });
    return fila ? this.aDominio(fila) : null;
  }

  async actualizar(
    socioId: number,
    cambios: MembresiaActualizable,
  ): Promise<Membresia | null> {
    const data: Prisma.MembresiaUpdateInput = {
      plan: cambios.plan,
      renueva_automatica: cambios.renueva_automatica,
      estado: cambios.estado,
    };

    if (cambios.plan) {
      data.fecha_fin = calcularVigencia(cambios.plan, new Date()).fecha_fin;
    }

    const fila = await this.prisma.membresia
      .update({
        where: { socio_id: socioId },
        data,
      })
      .catch((err) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          return null;
        }
        throw err;
      });

    return fila ? this.aDominio(fila) : null;
  }

  async marcarVencidas(): Promise<number> {
    const resultado = await this.prisma.membresia.updateMany({
      where: { estado: 'ACTIVA', fecha_fin: { lt: new Date() } },
      data: { estado: 'VENCIDA' },
    });
    return resultado.count;
  }

  // GET /bloqueados (Fase 4): no vigentes cuyo `updated_at` cambio desde
  // `desde` (sincronizacion incremental del puesto offline). `usuario_id`
  // sale de la relacion a Socio, que es la unica tabla con esa FK.
  async buscarNoVigentes(desde: Date): Promise<MembresiaNoVigente[]> {
    const filas = await this.prisma.membresia.findMany({
      where: {
        estado: { in: ['VENCIDA', 'SUSPENDIDA'] },
        updated_at: { gte: desde },
      },
      select: {
        estado: true,
        updated_at: true,
        socio: { select: { usuario_id: true } },
      },
      orderBy: { updated_at: 'asc' },
    });

    return filas.map((fila) => ({
      usuarioId: fila.socio.usuario_id,
      // El `in` de arriba ya acota el universo a estos dos valores; el cast
      // evita repetir el tipo completo de EstadoMembresia en la firma.
      motivo: fila.estado as 'VENCIDA' | 'SUSPENDIDA',
      desde: fila.updated_at,
    }));
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
      updated_at: fila.updated_at,
    };
  }
}
