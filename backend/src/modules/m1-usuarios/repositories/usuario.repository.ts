import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import { PrismaService } from '../../../commons/database/prisma.service';
import { mapearErrorPrisma } from '../../../commons/errors/prisma.mapper';
import type { RolUsuario, Usuario, UsuarioActualizable, UsuarioNuevo } from '../entities/usuario.entity';

export interface FiltrosUsuarios {
  rol?: RolUsuario;
  sedeId?: number;
  nombre?: string;
  email?: string;
}

// `empleado` es opcional en el tipo porque no todas las lecturas lo piden (por
// ejemplo, el login resuelve la sede por su cuenta). Cuando no se incluye,
// aDominio deja `sedeId` en null.
type UsuarioRow = Prisma.UsuarioGetPayload<Record<string, never>> & {
  empleado?: { sede_id: number } | null;
};

// La sede de trabajo se necesita en las respuestas de M1 (listado, detalle y
// alta) y ahora tambien en la UI de staff, que muestra y descarta las sedes
// ocupadas. Incluirla aca evita una consulta por fila.
const INCLUIR_EMPLEADO = { empleado: { select: { sede_id: true } } } as const;

// Capa de acceso a datos del usuario. Es la unica pieza de M1 que conoce Prisma:
// los services de arriba reciben el tipo `Usuario`, nunca una fila de Prisma.
@Injectable()
export class UsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    { rol, sedeId, nombre, email }: FiltrosUsuarios,
    { page, perPage }: OpcionesPaginacion,
  ): Promise<{ items: Usuario[]; total: number }> {
    const where = {
      ...(rol !== undefined && { rol }),
      // Sede de trabajo: solo quien tiene fila en EmpleadoSede de esa sede. No es
      // la sede de origen del socio (Socio.sede_origen_id).
      ...(sedeId !== undefined && { empleado: { sede_id: sedeId } }),
      // `insensitive` porque el contrato pide coincidencia parcial y el
      // usuario que busca "ana" espera encontrar "Ana".
      ...(nombre !== undefined && { nombre: { contains: nombre, mode: 'insensitive' as const } }),
      // El email es unico en el esquema, asi que va por igualdad.
      ...(email !== undefined && { email }),
    };

    const [filas, total] = await Promise.all([
      this.prisma.usuario.findMany({
        where,
        include: INCLUIR_EMPLEADO,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { id: 'asc' },
      }),
      this.prisma.usuario.count({ where }),
    ]);

    return {
      items: filas.map((fila) => this.aDominio(fila)),
      total,
    };
  }

  // El nested create de `empleado` es atomico: Prisma hace el INSERT de Usuario y el
  // de EmpleadoSede en la misma transaccion, asi que si la sede no existe o ya tiene
  // un recepcionista no queda un usuario RECEPCION sin puesto de trabajo.
  async crear(usuario: UsuarioNuevo): Promise<Usuario> {
    const fila = await this.prisma.usuario.create({
      data: {
        rol: usuario.rol,
        dni: usuario.dni,
        nombre: usuario.nombre,
        email: usuario.email,
        contrasenia: usuario.contrasenia,
        telefono: usuario.telefono ?? null,
        foto_url: usuario.fotoUrl ?? null,
        ...(usuario.sedeId !== undefined && { empleado: { create: { sede_id: usuario.sedeId } } }),
      },
      include: INCLUIR_EMPLEADO,
    });
    return this.aDominio(fila);
  }

  async buscarPorId(id: number): Promise<Usuario | null> {
    const fila = await this.prisma.usuario.findUnique({ where: { id }, include: INCLUIR_EMPLEADO });
    return fila ? this.aDominio(fila) : null;
  }

  // Dedicado (no reusa buscarPorDniOEmail): login busca por email exacto
  // solamente, y el `OR` de buscarPorDniOEmail existe para el chequeo de
  // unicidad del alta, no para esto.
  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const fila = await this.prisma.usuario.findUnique({ where: { email } });
    return fila ? this.aDominio(fila) : null;
  }

  async buscarPorDniOEmail(dni: string, email: string): Promise<Usuario | null> {
    const fila = await this.prisma.usuario.findFirst({
      where: { OR: [{ dni }, { email }] },
    });
    return fila ? this.aDominio(fila) : null;
  }

  async actualizar(id: number, cambios: UsuarioActualizable): Promise<Usuario | null> {
    try {
      const fila = await this.prisma.usuario.update({
        where: { id },
        data: {
          ...(cambios.nombre !== undefined && { nombre: cambios.nombre }),
          ...(cambios.telefono !== undefined && { telefono: cambios.telefono }),
          ...(cambios.fotoUrl !== undefined && { foto_url: cambios.fotoUrl }),
          ...(cambios.contrasenia !== undefined && { contrasenia: cambios.contrasenia }),
          ...(cambios.rol !== undefined && { rol: cambios.rol }),
        },
        include: INCLUIR_EMPLEADO,
      });
      return this.aDominio(fila);
    } catch (error) {
      if (mapearErrorPrisma(error) === 'NO_ENCONTRADO') {
        return null;
      }
      throw error;
    }
  }

  private aDominio(fila: UsuarioRow): Usuario {
    return {
      id: fila.id,
      rol: fila.rol,
      dni: fila.dni,
      nombre: fila.nombre,
      email: fila.email,
      contrasenia: fila.contrasenia,
      telefono: fila.telefono,
      fotoUrl: fila.foto_url,
      sedeId: fila.empleado?.sede_id ?? null,
    };
  }
}