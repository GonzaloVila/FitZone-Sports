import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { rangoDelDia } from '../../../commons/fechas';
import { PrismaService } from '../../../commons/database/prisma.service';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import type { Ingreso, IngresoNuevo } from '../entities/ingreso.entity';

// Lista blanca de filtros del GET /ingresos. Todos opcionales: sin filtros
// devuelve el historial paginado completo. `fecha` viene como día (YYYY-MM-DD)
// y el repository lo traduce a un rango de instantes con rangoDelDia.
export interface IngresoFiltros {
  sede_id?: number;
  usuario_id?: number;
  fecha?: string;
  dentro?: boolean;
}

// Resultado discriminado en vez de lanzar: tanto "aforo lleno" (RF-05) como
// "acceso duplicado" (RN-01) son reglas de negocio esperadas del flujo, no
// errores de infraestructura, y solo el propio crear() puede detectarlas de
// forma atómica. Devolverlas como dato evita que el service repita el conteo
// por fuera y reabra la ventana de carrera.
//
// - AFORO_LLENO: se decide acá adentro con el lock pesimista sobre Sede + count
//   + insert en una sola transacción (ADR-08 D5).
// - ACCESO_DUPLICADO: llega desde la base. El índice parcial único
//   ingreso_usuario_abierto_unq (ver migración 20260925010000) rechaza el
//   segundo INSERT abierto del mismo usuario, así que el P2002 que Prisma
//   levanta es la garantía de RN-01, no un fallo. El service igual mantiene un
//   chequeo previo por fuera de la transacción para el caso común, que es el
//   que da el 409 legible sin depender del error.
export type ResultadoCrearIngreso =
  | { ok: true; ingreso: Ingreso }
  | { ok: false; motivo: 'AFORO_LLENO' | 'ACCESO_DUPLICADO' };

type IngresoRow = Prisma.IngresoGetPayload<Record<string, never>>;

// Capa de acceso a datos del ingreso. Es la unica pieza de M2 que conoce Prisma,
// y tambien la unica que puede decidir el aforo: el lock pesimista y el count
// tienen que ocurrir en la misma transacción que el insert.
@Injectable()
export class IngresoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(ingreso: IngresoNuevo): Promise<ResultadoCrearIngreso> {
    try {
      return await this.prisma.$transaction(async (tx) => {
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
    } catch (error) {
      // RN-01: el índice parcial único ingreso_usuario_abierto_unq rechaza el
      // segundo ingreso abierto del mismo usuario. Cuando el service no lo ve a
      // tiempo (dos accesos simultáneos, o el lote de sincronización offline
      // de RNF-01), el motor es el que decide y el P2002 se traduce a la misma
      // respuesta de negocio en vez de exploitar como 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { ok: false as const, motivo: 'ACCESO_DUPLICADO' as const };
      }
      throw error;
    }
  }

  async listar(filtros: IngresoFiltros, { page, perPage }: OpcionesPaginacion): Promise<Ingreso[]> {
    const where: Prisma.IngresoWhereInput = {
      ...(filtros.sede_id !== undefined && { sede_id: filtros.sede_id }),
      ...(filtros.usuario_id !== undefined && { usuario_id: filtros.usuario_id }),
      // dentro=false no filtra: el contrato solo define el caso true (los que
      // siguen en la sede). Pedir los que ya egresaron sería un NOT sobre null,
      // que en SQL no significa "tiene egreso" sino "no es null".
      ...(filtros.dentro === true && { fecha_hora_egreso: null }),
      ...(filtros.fecha !== undefined && (() => {
        const { desde, hasta } = rangoDelDia(filtros.fecha as string);
        return { fecha_hora_ingreso: { gte: desde, lt: hasta } };
      })()),
    };

    const filas = await this.prisma.ingreso.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      // El id desempata: con la sincronización offline (RNF-01) dos ingresos
      // pueden compartir fecha_hora_ingreso al segundo, y sin un orden total la
      // paginación repite filas entre páginas.
      orderBy: [{ fecha_hora_ingreso: 'desc' }, { id: 'desc' }],
    });
    return filas.map((fila) => this.aDominio(fila));
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
