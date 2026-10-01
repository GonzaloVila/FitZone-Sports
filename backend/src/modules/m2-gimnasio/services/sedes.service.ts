import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { SedeIn } from '../dtos/sede-in.dto';
import { SedeOut } from '../dtos/sede-out.dto';
import type { Sede } from '../entities/sede.entity';
import { SedeRepository } from '../repositories/sede.repository';

@Injectable()
export class SedesService {
  constructor(private readonly sedes: SedeRepository) {}

  // Lo consumia el `SedeValidationAdapter` desde el servicio de canchas de M4.
  // Se queda aca porque la existencia de una sede es dato de la sede, no de un
  // puerto aparte: la consulta va contra el mismo repositorio que el resto.
  async existe(sedeId: number): Promise<boolean> {
    const sede = await this.sedes.buscarPorId(sedeId);
    return sede !== null;
  }

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
