import { Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { AforoOut } from '../dtos/aforo-out.dto';
import { IngresoIn } from '../dtos/ingreso-in.dto';
import { IngresoOut } from '../dtos/ingreso-out.dto';
import { exigirIngresoDeSuSede, exigirSedePropia } from './alcance-ingresos';
import { IngresosService } from './ingresos.service';

/**
 * Lo que los controllers de M2 le piden a `IngresosService` en nombre de una persona con sesion: aplica el alcance
 * por sede (`alcance-ingresos.ts`) y delega, sin que el servicio sepa de quien llama. El listado, el egreso y la
 * sincronizacion ya reciben su alcance por parametro y no pasan por aca.
 */
@Injectable()
export class IngresosAccesoService {
  constructor(private readonly ingresos: IngresosService) {}

  // El 403 va antes de buscar la sede: un RECEPCION no se entera de si otra sede existe.
  registrar(actor: UsuarioAutenticado, dto: IngresoIn): Promise<IngresoOut> {
    exigirSedePropia(actor, dto.sedeId);
    return this.ingresos.registrarIngreso(dto);
  }

  async obtener(actor: UsuarioAutenticado, ingresoId: number): Promise<IngresoOut> {
    const ingreso = await this.ingresos.obtenerIngreso(ingresoId);
    exigirIngresoDeSuSede(actor, ingresoId, ingreso.sedeId);
    return ingreso;
  }

  aforo(actor: UsuarioAutenticado, sedeId: number): Promise<AforoOut> {
    exigirSedePropia(actor, sedeId);
    return this.ingresos.obtenerAforo(sedeId);
  }
}
