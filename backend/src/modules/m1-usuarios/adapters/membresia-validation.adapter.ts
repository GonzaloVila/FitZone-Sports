import { Inject, Injectable } from '@nestjs/common';
import type {
  EstadoSocioMembresia,
  MembershipValidationPort,
  VigenciaMembresia,
} from '../../../commons/membresia/membership-validation.port';
import { estaVigente } from '../entities/membresia.entity';
import { MEMBRESIA_REPOSITORY, MembresiaRepository } from '../repositories/membresia.repository';
import { SOCIO_REPOSITORY, SocioRepository } from '../repositories/socio.repository';

// Adaptador real del MembershipValidationPort (D6): vive en m1-usuarios porque
// es el único módulo con acceso a SOCIO_REPOSITORY/MEMBRESIA_REPOSITORY. Se
// registra y exporta en usuarios.module.ts para que M2 y M3 lo consuman por token.
@Injectable()
export class MembresiaValidationAdapter implements MembershipValidationPort {
  constructor(
    @Inject(SOCIO_REPOSITORY) private readonly socios: SocioRepository,
    @Inject(MEMBRESIA_REPOSITORY) private readonly membresias: MembresiaRepository,
  ) {}

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
    const enMora = !vigente || membresia.estado === 'VENCIDA' || membresia.estado === 'SUSPENDIDA';
    return {
      esSocio: true,
      vigente,
      enMora,
    };
  }
}

