import { Inject, Injectable } from '@nestjs/common';
import type { SedeValidationPort } from '../../../commons/sede/sede-validation.port';
import { SEDE_REPOSITORY, SedeRepository } from '../repositories/sede.repository';

// Adaptador real del SedeValidationPort (D6): vive en m2-gimnasio porque es el
// único módulo con acceso a SEDE_REPOSITORY. Se registra y exporta en
// gimnasio.module.ts para que M4 lo consuma por token.
@Injectable()
export class SedeValidationAdapter implements SedeValidationPort {
  constructor(@Inject(SEDE_REPOSITORY) private readonly sedes: SedeRepository) {}

  async existeSede(sedeId: number): Promise<boolean> {
    const sede = await this.sedes.buscarPorId(sedeId);
    return sede !== null;
  }
}
