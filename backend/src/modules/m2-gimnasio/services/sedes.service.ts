import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { SedeIn } from '../dtos/sede-in.dto';
import { SedeOut } from '../dtos/sede-out.dto';
import { Sede } from '../entities/sede.entity';
import { SEDE_REPOSITORY, SedeRepository } from '../repositories/sede.repository';

@Injectable()
export class SedesService {
  constructor(
    @Inject(SEDE_REPOSITORY) private readonly sedes: SedeRepository,
  ) {}

  async listar(page: number, perPage: number): Promise<SedeOut[]> {
    const filas = await this.sedes.listar({ page, perPage });
    return filas.map((sede) => this.aOut(sede));
  }

  async crear(dto: SedeIn): Promise<SedeOut> {
    const sede = await this.sedes.crear(dto);
    return this.aOut(sede);
  }

  private aOut(sede: Sede): SedeOut {
    return plainToInstance(SedeOut, sede);
  }
}
