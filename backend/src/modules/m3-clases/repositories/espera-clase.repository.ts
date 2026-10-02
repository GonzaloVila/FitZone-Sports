import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import type {
  EstadoEspera,
  EsperaClase,
  EsperaClaseNueva,
} from '../entities/espera-clase.entity';
import type { ReservaClase } from '../entities/reserva-clase.entity';

export interface FiltrosEsperasClase {
  clase_id?: number;
  socio_id?: number;
  estado?: EstadoEspera;
}

export type MotivoFalloEspera = 'ESPERA_EXISTENTE' | 'CUPO_DISPONIBLE' | 'CLASE_INEXISTENTE';

export type ResultadoCrearEspera =
  | { ok: true; espera: EsperaClase }
  | { ok: false; motivo: MotivoFalloEspera };

export type MotivoFalloConfirmacionEspera =
  | 'NO_NOTIFICADA'
  | 'CUPO_TOMADO'
  | 'ESPERA_INEXISTENTE'
  | 'RESERVA_DUPLICADA';

export type ResultadoConfirmarEspera =
  | { ok: true; reserva: ReservaClase }
  | { ok: false; motivo: MotivoFalloConfirmacionEspera };

// Capa de acceso a datos de la espera. Es la unica pieza de M3 que conoce Prisma,
// y la unica que puede confirmar un cupo con lock sin reabrir la carrera.
@Injectable()
export class EsperaClaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    { clase_id, socio_id, estado }: FiltrosEsperasClase,
    { page, perPage }: OpcionesPaginacion,
  ): Promise<EsperaClase[]> {
    const where: Prisma.EsperaClaseWhereInput = {
      ...(clase_id !== undefined && { clase_id }),
      ...(socio_id !== undefined && { socio_id }),
      ...(estado !== undefined && { estado }),
    };

    const filas = await this.prisma.esperaClase.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      // El id desempata: fecha_anotacion es TIMESTAMP(3) y la genera la app con
      // new Date(), así que dos socios que se anotan en el mismo milisegundo
      // empatan. Sin un orden total, skip/take puede repetir o saltear filas
      // entre páginas. Mismo criterio que Ingreso.listar.
      orderBy: [{ fecha_anotacion: 'asc' }, { id: 'asc' }],
    });

    return filas.map((fila) => this.aDominio(fila));
  }

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

    let fila: {
      id: number;
      clase_id: number;
      socio_id: number;
      estado: string;
      fecha_anotacion: Date;
      fecha_notificacion: Date | null;
      fecha_confirmacion: Date | null;
    };
    try {
      fila = await this.prisma.esperaClase.create({
        data: {
          clase_id: espera.clase_id,
          socio_id: espera.socio_id,
          estado: 'EN_ESPERA',
          fecha_anotacion: espera.fecha_anotacion ?? new Date(),
        },
      });
    } catch (error) {
      // El findFirst de arriba es una lectura sin lock: entre esa comprobacion y
      // este INSERT otra peticion del mismo socio puede haber creado la espera.
      // El indice parcial unico unq_espera_clase_socio_activa (migracion
      // 20260928000000) es el que decide en la base, y su P2002 se traduce al
      // mismo motivo que ya producia la comprobacion en application.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { ok: false as const, motivo: 'ESPERA_EXISTENTE' as const };
      }
      throw error;
    }

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
      orderBy: [{ fecha_anotacion: 'asc' }, { id: 'asc' }],
    });
    return filas.map((f) => this.aDominio(f));
  }

  async listarSociosEnEsperaPorClase(claseId: number): Promise<number[]> {
    const filas = await this.prisma.esperaClase.findMany({
      where: {
        clase_id: claseId,
        estado: { not: 'CANCELADO' },
      },
      // Orden de notificación: la prioridad la define la anotación, y el id
      // desempata los empates. Ver comentario de listar() por qué hace falta.
      orderBy: [{ fecha_anotacion: 'asc' }, { id: 'asc' }],
      select: { socio_id: true },
    });
    return filas.map((f) => f.socio_id);
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
