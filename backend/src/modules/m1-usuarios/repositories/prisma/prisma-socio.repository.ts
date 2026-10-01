import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../commons/database/prisma.service';
import { Socio, SocioActualizable, SocioNuevo } from '../../entities/socio.entity';
import { calcularVigencia } from '../../entities/membresia.entity';
import { SocioRepository, FiltrosSocios } from '../socio.repository';
import type { OpcionesPaginacion } from '../../../../commons/paginacion';

// SocioOut expone nombre/email, asi que toda lectura de Socio necesita la
// relacion con Usuario. Se declara el payload a mano (no `typeof` de la const)
// porque SocioGetPayload exige los select en literal `true`, no `boolean`.
const USUARIO_SELECCION = {
  usuario: { select: { nombre: true, email: true } },
};

type SocioRow = Prisma.SocioGetPayload<{
  include: { usuario: { select: { nombre: true; email: true } } };
}>;

@Injectable()
export class PrismaSocioRepository implements SocioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    { sede_origen_id, estado_membresia, plan, nombre }: FiltrosSocios,
    { page, perPage }: OpcionesPaginacion,
  ): Promise<Socio[]> {
    const where: Prisma.SocioWhereInput = {
      ...(sede_origen_id !== undefined && {
        sede_origen_id: sede_origen_id,
      }),
      ...(nombre !== undefined && {
        usuario: { nombre: { contains: nombre, mode: 'insensitive' } },
      }),
    };

    // Los dos filtros de membresia se acumulan en el MISMO objeto para que
    // Prisma los ANDee sobre la relacion.
    if (estado_membresia !== undefined || plan !== undefined) {
      where.membresia = {
        ...(estado_membresia !== undefined && { estado: estado_membresia }),
        ...(plan !== undefined && { plan }),
      };
    }

    const filas = await this.prisma.socio.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { id: 'asc' },
      include: USUARIO_SELECCION,
    });
    return filas.map((fila) => this.aDominio(fila));
  }

  async crear(socio: SocioNuevo): Promise<Socio> {
    const fila = await this.prisma.$transaction(async (tx) => {
      const nuevoSocio = await tx.socio.create({
        data: {
          usuario_id: socio.usuario_id,
          sede_origen_id: socio.sede_origen_id,
          fecha_alta: new Date(),
        },
        // Ojo: este snapshot del Usuario es previo al update de `rol` de mas
        // abajo. No afecta a SocioOut (no expone `rol`), pero si alguna vez lo
        // agrega, saldra desactualizado en el POST /socios.
        include: USUARIO_SELECCION,
      });

      // No existe un socio sin membresia: la fila 1:1 se crea siempre, en la
      // misma transaccion que el socio. `calcularVigencia` sin segundo argumento
      // toma hoy como fecha_inicio.
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

      await tx.usuario.update({
        where: { id: socio.usuario_id },
        data: { rol: 'SOCIO' },
      });

      return nuevoSocio;
    });

    return this.aDominio(fila);
  }

  async buscarPorId(id: number): Promise<Socio | null> {
    const fila = await this.prisma.socio.findUnique({
      where: { id },
      include: USUARIO_SELECCION,
    });
    return fila ? this.aDominio(fila) : null;
  }

  async buscarPorUsuarioId(usuarioId: number): Promise<Socio | null> {
    const fila = await this.prisma.socio.findUnique({
      where: { usuario_id: usuarioId },
      include: USUARIO_SELECCION,
    });
    return fila ? this.aDominio(fila) : null;
  }

  async actualizar(id: number, cambios: SocioActualizable): Promise<Socio | null> {
    try {
      const fila = await this.prisma.socio.update({
        where: { id },
        data: {
          ...(cambios.sede_origen_id !== undefined && {
            sede_origen_id: cambios.sede_origen_id,
          }),
        },
        include: USUARIO_SELECCION,
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
      nombre: fila.usuario.nombre,
      email: fila.usuario.email,
      sede_origen_id: fila.sede_origen_id,
      fecha_alta: fila.fecha_alta,
    };
  }
}
