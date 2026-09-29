import { Inject, Injectable } from '@nestjs/common';
import type { ConsultaSocioPort } from '../../../commons/socio/consulta-socio.port';
import { SOCIO_REPOSITORY, type SocioRepository } from '../repositories/socio.repository';

// Adaptador real del ConsultaSocioPort: vive en m1-usuarios porque es el único módulo
// con acceso a SOCIO_REPOSITORY. Se registra y exporta en usuarios.module.ts para que
// M3 lo consuma por token.
@Injectable()
export class ConsultaSocioAdapter implements ConsultaSocioPort {
  constructor(@Inject(SOCIO_REPOSITORY) private readonly socios: SocioRepository) {}

  async obtenerEmail(socioId: number): Promise<string | null> {
    const socio = await this.socios.buscarPorId(socioId);
    return socio?.email ?? null;
  }
}
