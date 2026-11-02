import { Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { MembresiaOut } from '../dtos/membresia-out.dto';
import { SocioOut } from '../dtos/socio-out.dto';
import { DETALLE_NO_EXISTE, DETALLE_SOCIO_NO_EXISTE, exigirSocioPropio } from './alcance-usuarios';
import { MembresiasService } from './membresias.service';
import { SociosService } from './socios.service';

/**
 * Lo que los controllers de /socios y /socios/{socioId}/membresias le piden a M1 en nombre de una persona con sesion en
 * las lecturas de dueño: el SOCIO ve su socio y su membresia, el EXTERNO ninguno, y RECEPCION y GERENTE todos. El alta,
 * el listado, la baja y las modificaciones son solo de RECEPCION y GERENTE (@Roles) y llaman a los servicios directo.
 * El alta de socio y el cambio de plan emiten eventos desde esos servicios hacia M5: no pasan por aca.
 */
@Injectable()
export class SociosAccesoService {
  constructor(
    private readonly socios: SociosService,
    private readonly membresias: MembresiasService,
  ) {}

  async obtener(actor: UsuarioAutenticado, socioId: number): Promise<SocioOut> {
    exigirSocioPropio(actor, socioId, DETALLE_NO_EXISTE);
    return this.socios.obtenerPorId(socioId);
  }

  async obtenerMembresia(actor: UsuarioAutenticado, socioId: number): Promise<MembresiaOut> {
    exigirSocioPropio(actor, socioId, DETALLE_SOCIO_NO_EXISTE);
    return this.membresias.obtenerPorSocioId(socioId);
  }
}
