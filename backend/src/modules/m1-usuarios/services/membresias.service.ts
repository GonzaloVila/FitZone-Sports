import {
  Inject,
  Injectable,
} from '@nestjs/common';
import { conflictoDeDominio, recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { plainToInstance } from 'class-transformer';
import { CrearMembresiaDto } from '../dtos/crear-membresia.dto';
import { MembresiaOutDto } from '../dtos/membresia-out.dto';
import { MembresiaPatchDto } from '../dtos/membresia-patch.dto';
import { Membresia } from '../entities/membresia.entity';
import {
  MEMBRESIA_REPOSITORY,
  MembresiaRepository,
} from '../repositories/membresia.repository';
import { SOCIO_REPOSITORY, SocioRepository } from '../repositories/socio.repository';

@Injectable()
export class MembresiasService {
  constructor(
    @Inject(MEMBRESIA_REPOSITORY) private readonly membresias: MembresiaRepository,
    @Inject(SOCIO_REPOSITORY) private readonly socios: SocioRepository,
  ) {}

  async crear(socioId: number, dto: CrearMembresiaDto): Promise<MembresiaOutDto> {
    const socio = await this.socios.buscarPorId(socioId);
    if (!socio) {
      throw recursoNoEncontrado('No existe el socio indicado.');
    }

    const membresiaExistente = await this.membresias.buscarPorSocioId(socioId);
    if (membresiaExistente) {
      throw conflictoDeDominio(
        'Conflicto de membresía existente',
        'El socio ya tiene una membresía activa.',
      );
    }

    const fechaInicio = dto.fecha_inicio ? new Date(dto.fecha_inicio) : undefined;

    const membresia = await this.membresias.crear({
      socio_id: socioId,
      plan: dto.plan,
      renueva_automatica: dto.renueva_automatica,
      fecha_inicio: fechaInicio,
    });

    return this.aOut(membresia);
  }

  async obtenerPorSocioId(socioId: number): Promise<MembresiaOutDto> {
    const socio = await this.socios.buscarPorId(socioId);
    if (!socio) {
      throw recursoNoEncontrado('No existe el socio indicado.');
    }

    const membresia = await this.membresias.buscarPorSocioId(socioId);
    if (!membresia) {
      throw recursoNoEncontrado('El socio no posee una membresía activa.');
    }

    return this.aOut(membresia);
  }

  async modificar(socioId: number, dto: MembresiaPatchDto): Promise<MembresiaOutDto> {
    const socio = await this.socios.buscarPorId(socioId);
    if (!socio) {
      throw recursoNoEncontrado('No existe el socio indicado.');
    }

    const membresia = await this.membresias.actualizar(socioId, dto);
    if (!membresia) {
      throw recursoNoEncontrado('El socio no posee una membresía activa.');
    }

    return this.aOut(membresia);
  }

  private aOut(membresia: Membresia): MembresiaOutDto {
    return plainToInstance(MembresiaOutDto, membresia);
  }
}
