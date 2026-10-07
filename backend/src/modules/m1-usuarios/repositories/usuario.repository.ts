import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import { PrismaService } from '../../../commons/database/prisma.service';
import { mapearErrorPrisma } from '../../../commons/errors/prisma.mapper';
import type { RolUsuario, Usuario, UsuarioActualizable, UsuarioNuevo } from '../entities/usuario.entity';

export interface FiltrosUsuarios {
  rol?: RolUsuario;
  nombre?: string;
  email?: string;
}

type UsuarioRow = Prisma.UsuarioGetPayload<Record<string, never>>;

// Capa de acceso a datos del usuario. Es la unica pieza de M1 que conoce Prisma:
// los services de arriba reciben el tipo `Usuario`, nunca una fila de Prisma.
@Injectable()
export class UsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    { rol, nombre, email }: FiltrosUsuarios,
    { page, perPage }: OpcionesPaginacion,
  ): Promise<Usuario[]> {
    const filas = await this.prisma.usuario.findMany({
      where: {
        ...(rol !== undefined && { rol }),
        // `insensitive` porque el contrato pide coincidencia parcial y el
        // usuario que busca "ana" espera encontrar "Ana".
        ...(nombre !== undefined && { nombre: { contains: nombre, mode: 'insensitive' } }),
        // El email es unico en el esquema, asi que va por igualdad.
        ...(email !== undefined && { email }),
      },
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { id: 'asc' },
    });
    return filas.map((fila) => this.aDominio(fila));
  }

  async crear(usuario: UsuarioNuevo): Promise<Usuario> {
    const fila = await this.prisma.usuario.create({ data: usuario });
    return this.aDominio(fila);
  }

  async buscarPorId(id: number): Promise<Usuario | null> {
    const fila = await this.prisma.usuario.findUnique({ where: { id } });
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
      const fila = await this.prisma.usuario.update({ where: { id }, data: cambios });
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
      foto_url: fila.foto_url,
    };
  }
}