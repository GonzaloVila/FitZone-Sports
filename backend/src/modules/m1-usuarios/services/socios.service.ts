import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CrearSocioDto } from '../dtos/crear-socio.dto';
import { ModificarSocioDto } from '../dtos/modificar-socio.dto';
import { SocioOutDto } from '../dtos/socio-out.dto';
import { Socio, SocioActualizable } from '../entities/socio.entity';
import { SOCIO_REPOSITORY, SocioRepository } from '../repositories/socio.repository';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../repositories/usuario.repository';

@Injectable()
export class SociosService {
  constructor(
    @Inject(SOCIO_REPOSITORY) private readonly socios: SocioRepository,
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
  ) {}

  async crear(dto: CrearSocioDto): Promise<SocioOutDto> {
    const usuario = await this.usuarios.buscarPorId(dto.usuario_id);
    if (!usuario) {
      throw new NotFoundException('No existe el usuario indicado.');
    }
    if (usuario.rol === 'SOCIO') {
      throw new ConflictException('El usuario ya es socio.');
    }

    const socio = await this.socios.crear({
      usuario_id: dto.usuario_id,
      sede_origen_id: dto.sede_origen_id,
      plan: dto.plan,
    });

    return this.aOut(socio);
  }

  async obtenerPorId(id: number): Promise<SocioOutDto> {
    const socio = await this.socios.buscarPorId(id);
    if (!socio) {
      throw new NotFoundException('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(socio);
  }

  async modificar(id: number, dto: ModificarSocioDto): Promise<SocioOutDto> {
    const cambios: SocioActualizable = {};
    if (dto.sede_origen_id !== undefined) {
      cambios.sede_origen_id = dto.sede_origen_id;
    }

    const socio = await this.socios.actualizar(id, cambios);
    if (!socio) {
      throw new NotFoundException('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(socio);
  }

  async dejarDeSerSocio(id: number): Promise<void> {
    const socio = await this.socios.buscarPorId(id);
    if (!socio) {
      throw new NotFoundException('No existe el recurso solicitado para el id indicado.');
    }
    await this.socios.eliminar(id);
  }

  private aOut(socio: Socio): SocioOutDto {
    return plainToInstance(SocioOutDto, socio);
  }
}
