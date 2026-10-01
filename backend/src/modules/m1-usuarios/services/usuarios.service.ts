import { Injectable } from '@nestjs/common';
import { conflictoDeDominio, recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import * as bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { UsuarioIn } from '../dtos/usuario-in.dto';
import { ListarUsuariosQueryDto } from '../dtos/listar-usuarios-query.dto';
import { UsuarioPatch } from '../dtos/usuario-patch.dto';
import { UsuarioOut } from '../dtos/usuario-out.dto';
import { Usuario, UsuarioActualizable } from '../entities/usuario.entity';
import { UsuarioRepository } from '../repositories/usuario.repository';

const SALT_ROUNDS = 10;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly usuarios: UsuarioRepository,
  ) {}

  async crear(dto: UsuarioIn): Promise<UsuarioOut> {
    const existente = await this.usuarios.buscarPorDniOEmail(dto.dni, dto.email);
    if (existente) {
      throw conflictoDeDominio(
        'Conflicto de unicidad',
        existente.dni === dto.dni
          ? `El DNI ${dto.dni} ya está registrado.`
          : `El email ${dto.email} ya está registrado.`,
      );
    }

    const contrasenia = await bcrypt.hash(dto.contrasenia, SALT_ROUNDS);
    const usuario = await this.usuarios.crear({
      rol: dto.rol,
      dni: dto.dni,
      nombre: dto.nombre,
      email: dto.email,
      contrasenia,
      telefono: dto.telefono,
      foto_url: dto.foto_url,
    });

    return this.aOut(usuario);
  }

  async listar(dto: ListarUsuariosQueryDto): Promise<UsuarioOut[]> {
    const usuarios = await this.usuarios.listar(
      { rol: dto.rol, nombre: dto.nombre, email: dto.email },
      // Los defaults del DTO ya cubren el caso sin query params; estos `??`
      // son la red de seguridad para cuando el service se llame sin el pipe.
      { page: dto.page ?? 1, perPage: dto.per_page ?? 20 },
    );
    return usuarios.map((usuario) => this.aOut(usuario));
  }

  async obtenerPorId(id: number): Promise<UsuarioOut> {
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(usuario);
  }

  async modificar(id: number, dto: UsuarioPatch): Promise<UsuarioOut> {
    const cambios: UsuarioActualizable = {};
    if (dto.nombre !== undefined) {
      cambios.nombre = dto.nombre;
    }
    if (dto.telefono !== undefined) {
      cambios.telefono = dto.telefono;
    }
    if (dto.foto_url !== undefined) {
      cambios.foto_url = dto.foto_url;
    }
    if (dto.contrasenia !== undefined) {
      cambios.contrasenia = await bcrypt.hash(dto.contrasenia, SALT_ROUNDS);
    }

    const usuario = await this.usuarios.actualizar(id, cambios);
    if (!usuario) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(usuario);
  }

  private aOut(usuario: Usuario): UsuarioOut {
    return plainToInstance(UsuarioOut, usuario);
  }
}