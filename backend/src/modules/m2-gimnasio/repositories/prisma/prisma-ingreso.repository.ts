import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../commons/database/prisma.service';
import { Ingreso, IngresoNuevo } from '../../entities/ingreso.entity';
import { IngresoRepository, ResultadoCrearIngreso } from '../ingreso.repository';

type IngresoRow = Prisma.IngresoGetPayload<Record<string, never>>;

@Injectable()
export class PrismaIngresoRepository implements IngresoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(ingreso: IngresoNuevo): Promise<ResultadoCrearIngreso> {
    return this.prisma.$transaction(async (tx) => {
      // Lock pesimista de la fila Sede (ADR-08 D5): serializa los ingresos
      // concurrentes de la misma sede sin agregar una columna contador ni un
      // retry-loop optimista. El aforo sigue siendo un COUNT derivado.
      const filasSede = await tx.$queryRaw<{ aforo_maximo: number }[]>`
        SELECT "aforo_maximo" FROM "Sede" WHERE "id" = ${ingreso.sede_id} FOR UPDATE
      `;
      const sede = filasSede[0];
      if (!sede) {
        throw new Error(
          `Sede ${ingreso.sede_id} no existe (debe validarse antes de llamar a crear()).`,
        );
      }

      const aforoActual = await tx.ingreso.count({
        where: { sede_id: ingreso.sede_id, fecha_hora_egreso: null },
      });

      if (aforoActual >= sede.aforo_maximo) {
        return { ok: false as const, motivo: 'AFORO_LLENO' as const };
      }

      const fila = await tx.ingreso.create({
        data: {
          sede_id: ingreso.sede_id,
          usuario_id: ingreso.usuario_id,
          fecha_hora_ingreso: ingreso.fecha_hora_ingreso ?? new Date(),
          validado_offline: ingreso.validado_offline ?? false,
        },
      });

      return { ok: true as const, ingreso: this.aDominio(fila) };
    });
  }

  async buscarPorId(id: number): Promise<Ingreso | null> {
    const fila = await this.prisma.ingreso.findUnique({ where: { id } });
    return fila ? this.aDominio(fila) : null;
  }

  async buscarActivoPorUsuario(usuarioId: number): Promise<Ingreso | null> {
    const fila = await this.prisma.ingreso.findFirst({
      where: { usuario_id: usuarioId, fecha_hora_egreso: null },
    });
    return fila ? this.aDominio(fila) : null;
  }

  async marcarEgreso(id: number, fecha: Date): Promise<Ingreso | null> {
    const fila = await this.prisma.ingreso
      .update({ where: { id }, data: { fecha_hora_egreso: fecha } })
      .catch((error) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          return null;
        }
        throw error;
      });
    return fila ? this.aDominio(fila) : null;
  }

  async contarActivosPorSede(sedeId: number): Promise<number> {
    return this.prisma.ingreso.count({
      where: { sede_id: sedeId, fecha_hora_egreso: null },
    });
  }

  private aDominio(fila: IngresoRow): Ingreso {
    return {
      id: fila.id,
      sede_id: fila.sede_id,
      usuario_id: fila.usuario_id,
      fecha_hora_ingreso: fila.fecha_hora_ingreso,
      fecha_hora_egreso: fila.fecha_hora_egreso,
      validado_offline: fila.validado_offline,
    };
  }
}
