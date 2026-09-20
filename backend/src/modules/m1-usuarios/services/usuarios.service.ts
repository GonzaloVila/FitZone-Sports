import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { CrearUsuarioDto } from '../dtos/crear-usuario.dto';
import { ModificarUsuarioDto } from '../dtos/modificar-usuario.dto';
import { UsuarioOutDto } from '../dtos/usuario-out.dto';
import {
  USUARIO_REPOSITORY,
  Usuario,
  UsuarioActualizable,
  UsuarioRepository,
} from '../repositories/usuario.repository';

const SALT_ROUNDS = 10;

@Injectable()
export class UsuariosService {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
  ) {}

  async crear(dto: CrearUsuarioDto): Promise<UsuarioOutDto> {
    const existente = await this.usuarios.buscarPorDniOEmail(dto.dni, dto.email);
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese dni o email.');
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

  async obtenerPorId(id: number): Promise<UsuarioOutDto> {
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) {
      throw new NotFoundException('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(usuario);
  }

  async modificar(id: number, dto: ModificarUsuarioDto): Promise<UsuarioOutDto> {
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
      throw new NotFoundException('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(usuario);
  }

  private aOut(usuario: Usuario): UsuarioOutDto {
    return plainToInstance(UsuarioOutDto, usuario);
  }
}