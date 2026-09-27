import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../commons/database/prisma.service';
import type { EsperaClase, EsperaClaseNueva } from '../../entities/espera-clase.entity';
import type { ReservaClase } from '../../entities/reserva-clase.entity';
import type {
  EsperaClaseRepository,
  ResultadoConfirmarEspera,
  ResultadoCrearEspera,
} from '../espera-clase.repository';

@Injectable()
export class PrismaEsperaClaseRepository implements EsperaClaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(espera: EsperaClaseNueva): Promise<ResultadoCrearEspera> {
    const clase = await this.prisma.clase.findUnique({
      where: { id: espera.clase_id },
      include: {
        _count: {
          select: {
            reservas: { where: { estado: 'CONFIRMADA' } },
          },
        },
      },
    });

    if (!clase) {
      return { ok: false as const, motivo: 'CLASE_INEXISTENTE' as const };
    }

    // RF-08: solo se puede enlistar si la clase está completa
    if (clase._count.reservas < clase.capacidad) {
      return { ok: false as const, motivo: 'CUPO_DISPONIBLE' as const };
    }

    // Comprobación de no duplicidad en espera activa
    const esperaPrevia = await this.prisma.esperaClase.findFirst({
      where: {
        clase_id: espera.clase_id,
        socio_id: espera.socio_id,
        estado: { in: ['EN_ESPERA', 'NOTIFICADO'] },
      },
    });

    if (esperaPrevia) {
      return { ok: false as const, motivo: 'ESPERA_EXISTENTE' as const };
    }

    // Comprobación de que no tenga ya reserva confirmada
    const reservaPrevia = await this.prisma.reservaClase.findFirst({
      where: {
        clase_id: espera.clase_id,
        socio_id: espera.socio_id,
        estado: 'CONFIRMADA',
      },
    });

    if (reservaPrevia) {
      return { ok: false as const, motivo: 'ESPERA_EXISTENTE' as const };
    }

    const fila = await this.prisma.esperaClase.create({
      data: {
        clase_id: espera.clase_id,
        socio_id: espera.socio_id,
        estado: 'EN_ESPERA',
        fecha_anotacion: espera.fecha_anotacion ?? new Date(),
      },
    });

    return {
      ok: true as const,
      espera: this.aDominio(fila),
    };
  }

  async buscarPorId(id: number): Promise<EsperaClase | null> {
    const fila = await this.prisma.esperaClase.findUnique({ where: { id } });
    return fila ? this.aDominio(fila) : null;
  }

  async buscarActivaPorClaseYSocio(claseId: number, socioId: number): Promise<EsperaClase | null> {
    const fila = await this.prisma.esperaClase.findFirst({
      where: {
        clase_id: claseId,
        socio_id: socioId,
        estado: { in: ['EN_ESPERA', 'NOTIFICADO'] },
      },
    });
    return fila ? this.aDominio(fila) : null;
  }

  async marcarCancelada(id: number): Promise<EsperaClase | null> {
    try {
      const fila = await this.prisma.esperaClase.update({
        where: { id },
        data: { estado: 'CANCELADO' },
      });
      return this.aDominio(fila);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  async buscarEnEsperaPorClase(claseId: number): Promise<EsperaClase[]> {
    const filas = await this.prisma.esperaClase.findMany({
      where: {
        clase_id: claseId,
        estado: 'EN_ESPERA',
      },
      orderBy: { fecha_anotacion: 'asc' },
    });
    return filas.map((f) => this.aDominio(f));
  }

  async marcarNotificados(claseId: number, fecha: Date): Promise<number> {
    const resultado = await this.prisma.esperaClase.updateMany({
      where: {
        clase_id: claseId,
        estado: 'EN_ESPERA',
      },
      data: {
        estado: 'NOTIFICADO',
        fecha_notificacion: fecha,
      },
    });
    return resultado.count;
  }

  async confirmarEsperaConLock(esperaId: number): Promise<ResultadoConfirmarEspera> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const espera = await tx.esperaClase.findUnique({ where: { id: esperaId } });
        if (!espera) {
          return { ok: false as const, motivo: 'ESPERA_INEXISTENTE' as const };
        }

        if (espera.estado !== 'NOTIFICADO') {
          return { ok: false as const, motivo: 'NO_NOTIFICADA' as const };
        }

        // Lock pesimista sobre la clase para competencia first-come
        const filasClase = await tx.$queryRaw<{ capacidad: number }[]>`
          SELECT "capacidad" FROM "Clase" WHERE "id" = ${espera.clase_id} FOR UPDATE
        `;
        const clase = filasClase[0];
        if (!clase) {
          return { ok: false as const, motivo: 'ESPERA_INEXISTENTE' as const };
        }

        const confirmadas = await tx.reservaClase.count({
          where: { clase_id: espera.clase_id, estado: 'CONFIRMADA' },
        });

        if (confirmadas >= clase.capacidad) {
          return { ok: false as const, motivo: 'CUPO_TOMADO' as const };
        }

        const yaTieneReserva = await tx.reservaClase.findFirst({
          where: {
            clase_id: espera.clase_id,
            socio_id: espera.socio_id,
            estado: 'CONFIRMADA',
          },
        });

        if (yaTieneReserva) {
          return { ok: false as const, motivo: 'RESERVA_DUPLICADA' as const };
        }

        // Transiciona la espera a CONFIRMADO
        await tx.esperaClase.update({
          where: { id: esperaId },
          data: {
            estado: 'CONFIRMADO',
            fecha_confirmacion: new Date(),
          },
        });

        // Crea la reserva de clase efectiva
        const reservaFila = await tx.reservaClase.create({
          data: {
            clase_id: espera.clase_id,
            socio_id: espera.socio_id,
            estado: 'CONFIRMADA',
          },
        });

        return {
          ok: true as const,
          reserva: {
            id: reservaFila.id,
            clase_id: reservaFila.clase_id,
            socio_id: reservaFila.socio_id,
            estado: reservaFila.estado as 'CONFIRMADA' | 'CANCELADA',
          },
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { ok: false as const, motivo: 'RESERVA_DUPLICADA' as const };
      }
      throw error;
    }
  }

  private aDominio(fila: {
    id: number;
    clase_id: number;
    socio_id: number;
    estado: string;
    fecha_anotacion: Date;
    fecha_notificacion: Date | null;
    fecha_confirmacion: Date | null;
  }): EsperaClase {
    return {
      id: fila.id,
      clase_id: fila.clase_id,
      socio_id: fila.socio_id,
      estado: fila.estado as EsperaClase['estado'],
      fecha_anotacion: fila.fecha_anotacion,
      fecha_notificacion: fila.fecha_notificacion,
      fecha_confirmacion: fila.fecha_confirmacion,
    };
  }
}
