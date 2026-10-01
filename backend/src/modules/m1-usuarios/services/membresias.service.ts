import {
  Inject,
  Injectable,
} from '@nestjs/common';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { plainToInstance } from 'class-transformer';
import { MembresiaOut } from '../dtos/membresia-out.dto';
import { MembresiaPatch } from '../dtos/membresia-patch.dto';
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

  async obtenerPorSocioId(socioId: number): Promise<MembresiaOut> {
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

  async modificar(socioId: number, dto: MembresiaPatch): Promise<MembresiaOut> {
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

  private aOut(membresia: Membresia): MembresiaOut {
    return plainToInstance(MembresiaOut, membresia);
  }
}
