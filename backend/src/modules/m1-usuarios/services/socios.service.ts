import { Injectable } from '@nestjs/common';
import { conflictoDeDominio, recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { plainToInstance } from 'class-transformer';
import { SocioIn } from '../dtos/socio-in.dto';
import { ListarSociosQueryDto } from '../dtos/listar-socios-query.dto';
import { SocioPatch } from '../dtos/socio-patch.dto';
import { SocioOut } from '../dtos/socio-out.dto';
import { Socio, SocioActualizable } from '../entities/socio.entity';
import { SocioRepository } from '../repositories/socio.repository';
import { UsuarioRepository } from '../repositories/usuario.repository';

@Injectable()
export class SociosService {
  constructor(
    private readonly socios: SocioRepository,
    private readonly usuarios: UsuarioRepository,
  ) {}

  // Lo consumia el `ConsultaSocioAdapter` desde el observer de email de M3.
  // Se queda aca porque el email es dato del socio, no de un puerto aparte.
  async obtenerEmail(socioId: number): Promise<string | null> {
    const socio = await this.socios.buscarPorId(socioId);
    return socio?.email ?? null;
  }


  async crear(dto: SocioIn): Promise<SocioOut> {
    const usuario = await this.usuarios.buscarPorId(dto.usuario_id);
    if (!usuario) {
      throw recursoNoEncontrado('No existe el usuario indicado.');
    }
    if (usuario.rol === 'SOCIO') {
      throw conflictoDeDominio(
        'El usuario ya es socio',
        `El usuario ${usuario.id} ya tiene un registro de socio.`,
      );
    }

    const socio = await this.socios.crear({
      usuario_id: dto.usuario_id,
      sede_origen_id: dto.sede_origen_id,
      plan: dto.plan,
    });

    return this.aOut(socio);
  }

  async listar(dto: ListarSociosQueryDto): Promise<SocioOut[]> {
    const socios = await this.socios.listar(
      {
        sede_origen_id: dto.sede_origen_id,
        estado_membresia: dto.estado_membresia,
        plan: dto.plan,
        nombre: dto.nombre,
      },
      { page: dto.page ?? 1, perPage: dto.per_page ?? 20 },
    );
    return socios.map((socio) => this.aOut(socio));
  }

  async obtenerPorId(id: number): Promise<SocioOut> {
    const socio = await this.socios.buscarPorId(id);
    if (!socio) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(socio);
  }

  async modificar(id: number, dto: SocioPatch): Promise<SocioOut> {
    const cambios: SocioActualizable = {};
    if (dto.sede_origen_id !== undefined) {
      cambios.sede_origen_id = dto.sede_origen_id;
    }

    const socio = await this.socios.actualizar(id, cambios);
    if (!socio) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(socio);
  }

  async dejarDeSerSocio(id: number): Promise<void> {
    const socio = await this.socios.buscarPorId(id);
    if (!socio) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    await this.socios.eliminar(id);
  }

  private aOut(socio: Socio): SocioOut {
    return plainToInstance(SocioOut, socio);
  }
}
