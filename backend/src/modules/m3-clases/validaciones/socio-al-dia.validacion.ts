import { Injectable } from '@nestjs/common';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { socioEnMoraParaReserva } from '../errors/reservas-clases.errors';
import type { ContextoReserva, ValidacionDeReserva } from './validacion-de-reserva';

// Eslabón 2 (RN-03): el socio tiene que existir y estar al día. Un socio con cuota
// vencida no reserva con tarifa bonificada (403), y un no-socio es 404.
@Injectable()
export class SocioAlDia implements ValidacionDeReserva {
  validar(ctx: ContextoReserva): void {
    if (!ctx.estadoSocio.esSocio) {
      throw recursoNoEncontrado('El socio indicado no existe.');
    }
    if (ctx.estadoSocio.enMora || !ctx.estadoSocio.vigente) {
      throw socioEnMoraParaReserva(ctx.socioId);
    }
  }
}
