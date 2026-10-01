import { Injectable } from '@nestjs/common';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { plainToInstance } from 'class-transformer';
import { MembresiaOut } from '../dtos/membresia-out.dto';
import { MembresiaPatch } from '../dtos/membresia-patch.dto';
import { estaVigente } from '../entities/membresia.entity';
import type {
  EstadoSocioMembresia,
  Membresia,
  VigenciaMembresia,
} from '../entities/membresia.entity';
import { MembresiaRepository } from '../repositories/membresia.repository';
import { SocioRepository } from '../repositories/socio.repository';

@Injectable()
export class MembresiasService {
  constructor(
    private readonly membresias: MembresiaRepository,
    private readonly socios: SocioRepository,
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

  // Las dos consultas de vigencia vivian en el adapter
  // `MembresiaValidationAdapter` que se elimino con el puerto. Son la puerta de
  // entrada de M2, M3 y M4 a la regla de membresia (RF-03, RN-03), asi que la
  // regla se queda aqui, en el unico lugar que tiene los dos repositorios.
  async consultarVigencia(usuarioId: number): Promise<VigenciaMembresia> {
    const socio = await this.socios.buscarPorUsuarioId(usuarioId);
    if (!socio) {
      return { vigente: false };
    }

    const membresia = await this.membresias.buscarPorSocioId(socio.id);
    if (!membresia) {
      return { vigente: false };
    }

    return { vigente: estaVigente(membresia) };
  }

  // RN-03: un socio sin membresia esta en mora por definicion, y tambien esta
  // en mora la que tiene una membresia vencida o suspendida.
  async consultarVigenciaPorSocio(socioId: number): Promise<EstadoSocioMembresia> {
    const socio = await this.socios.buscarPorId(socioId);
    if (!socio) {
      return { esSocio: false, vigente: false, enMora: false };
    }

    const membresia = await this.membresias.buscarPorSocioId(socio.id);
    if (!membresia) {
      return { esSocio: true, vigente: false, enMora: true };
    }

    const vigente = estaVigente(membresia);
    const enMora =
      !vigente || membresia.estado === 'VENCIDA' || membresia.estado === 'SUSPENDIDA';
    return {
      esSocio: true,
      vigente,
      enMora,
    };
  }

  private aOut(membresia: Membresia): MembresiaOut {
    return plainToInstance(MembresiaOut, membresia);
  }
}
