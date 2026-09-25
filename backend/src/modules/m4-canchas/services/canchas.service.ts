import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { SEDE_VALIDATION_PORT, SedeValidationPort } from '../../../commons/sede/sede-validation.port';
import { CanchaOutDto } from '../dtos/cancha-out.dto';
import { CrearCanchaDto } from '../dtos/crear-cancha.dto';
import { ModificarCanchaDto } from '../dtos/modificar-cancha.dto';
import { Cancha } from '../entities/cancha.entity';
import { CANCHA_REPOSITORY, CanchaRepository } from '../repositories/cancha.repository';

@Injectable()
export class CanchasService {
  constructor(
    @Inject(CANCHA_REPOSITORY) private readonly canchas: CanchaRepository,
    @Inject(SEDE_VALIDATION_PORT) private readonly sedes: SedeValidationPort,
  ) {}

  async crear(sedeId: number, dto: CrearCanchaDto): Promise<CanchaOutDto> {
    const existeSede = await this.sedes.existeSede(sedeId);
    if (!existeSede) {
      throw new NotFoundException('No existe la sede indicada.');
    }

    const cancha = await this.canchas.crear({
      sede_id: sedeId,
      tipo: dto.tipo,
      costo_por_hora: dto.costo_por_hora,
      estado: dto.estado ?? 'OPERATIVA',
    });
    return this.aOut(cancha);
  }

  async listar(
    sedeId: number,
    filtros: { estado?: Cancha['estado']; page: number; perPage: number },
  ): Promise<CanchaOutDto[]> {
    const filas = await this.canchas.listarPorSede(sedeId, filtros);
    return filas.map((cancha) => this.aOut(cancha));
  }

  async obtener(id: number): Promise<CanchaOutDto> {
    const cancha = await this.canchas.buscarPorId(id);
    if (!cancha) {
      throw new NotFoundException('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(cancha);
  }

  async actualizar(id: number, dto: ModificarCanchaDto): Promise<CanchaOutDto> {
    const cancha = await this.canchas.actualizar(id, {
      costo_por_hora: dto.costo_por_hora,
      estado: dto.estado,
    });
    if (!cancha) {
      throw new NotFoundException('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(cancha);
  }

  private aOut(cancha: Cancha): CanchaOutDto {
    return plainToInstance(CanchaOutDto, cancha);
  }
}
