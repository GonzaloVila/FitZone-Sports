import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { SEDE_VALIDATION_PORT, SedeValidationPort } from '../../../commons/sede/sede-validation.port';
import { CanchaIn } from '../dtos/cancha-in.dto';
import { CanchaOut } from '../dtos/cancha-out.dto';
import { CanchaPatch } from '../dtos/cancha-patch.dto';
import { Cancha } from '../entities/cancha.entity';
import { CANCHA_REPOSITORY, CanchaRepository } from '../repositories/cancha.repository';

const NO_ENCONTRADO = 'No existe el recurso solicitado para el id indicado.';

@Injectable()
export class CanchasService {
  constructor(
    @Inject(CANCHA_REPOSITORY) private readonly canchas: CanchaRepository,
    @Inject(SEDE_VALIDATION_PORT) private readonly sedes: SedeValidationPort,
  ) {}

  async crear(sedeId: number, dto: CanchaIn): Promise<CanchaOut> {
    await this.exigirSede(sedeId);

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
  ): Promise<CanchaOut[]> {
    // El contrato declara 404 tambien en el listado, no solo en el alta.
    await this.exigirSede(sedeId);

    const filas = await this.canchas.listarPorSede(sedeId, filtros);
    return filas.map((cancha) => this.aOut(cancha));
  }

  async obtener(id: number): Promise<CanchaOut> {
    const cancha = await this.canchas.buscarPorId(id);
    if (!cancha) {
      throw new NotFoundException(NO_ENCONTRADO);
    }
    return this.aOut(cancha);
  }

  async actualizar(id: number, dto: CanchaPatch): Promise<CanchaOut> {
    const cancha = await this.canchas.actualizar(id, {
      costo_por_hora: dto.costo_por_hora,
      estado: dto.estado,
    });
    if (!cancha) {
      throw new NotFoundException(NO_ENCONTRADO);
    }
    return this.aOut(cancha);
  }

  private async exigirSede(sedeId: number): Promise<void> {
    if (!(await this.sedes.existeSede(sedeId))) {
      throw new NotFoundException(NO_ENCONTRADO);
    }
  }

  private aOut(cancha: Cancha): CanchaOut {
    return plainToInstance(CanchaOut, cancha);
  }
}
