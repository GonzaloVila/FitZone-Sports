import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../commons/database/prisma.service';
import { Socio, SocioActualizable, SocioNuevo } from '../../entities/socio.entity';
import { calcularVigencia } from '../../entities/membresia.entity';
import { SocioRepository } from '../socio.repository';

type SocioRow = Prisma.SocioGetPayload<Record<string, never>>;

@Injectable()
export class PrismaSocioRepository implements SocioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(socio: SocioNuevo): Promise<Socio> {
    const fila = await this.prisma.$transaction(async (tx) => {
      const nuevoSocio = await tx.socio.create({
        data: {
          usuario_id: socio.usuario_id,
          sede_id: socio.sede_origen_id,
          fecha_alta: new Date(),
        },
      });

      if (socio.plan) {
        const { fecha_inicio, fecha_fin } = calcularVigencia(socio.plan);
        await tx.membresia.create({
          data: {
            socio_id: nuevoSocio.id,
            plan: socio.plan,
            estado: 'ACTIVA',
            fecha_inicio,
            fecha_fin,
            renueva_automatica: false,
          },
        });
      }

      await tx.usuario.update({
        where: { id: socio.usuario_id },
        data: { rol: 'SOCIO' },
      });

      return nuevoSocio;
    });

    return this.aDominio(fila);
  }

  async buscarPorId(id: number): Promise<Socio | null> {
    const fila = await this.prisma.socio.findUnique({ where: { id } });
    return fila ? this.aDominio(fila) : null;
  }

  async actualizar(id: number, cambios: SocioActualizable): Promise<Socio | null> {
    try {
      const fila = await this.prisma.socio.update({
        where: { id },
        data: {
          ...(cambios.sede_origen_id !== undefined && { sede_id: cambios.sede_origen_id }),
        },
      });
      return this.aDominio(fila);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }

  async eliminar(id: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const socio = await tx.socio.findUnique({ where: { id } });
      if (!socio) {
        return;
      }
      await tx.membresia.deleteMany({ where: { socio_id: id } });
      await tx.socio.delete({ where: { id } });
      await tx.usuario.update({
        where: { id: socio.usuario_id },
        data: { rol: 'EXTERNO' },
      });
    });
  }

  private aDominio(fila: SocioRow): Socio {
    return {
      id: fila.id,
      usuario_id: fila.usuario_id,
      sede_origen_id: fila.sede_id,
      fecha_alta: fila.fecha_alta,
    };
  }
}
