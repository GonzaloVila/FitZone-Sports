import { Injectable } from '@nestjs/common';
import {
  ReservaClaseParaCobro,
  penalidadCancelacionTardia,
} from '../entities/reserva-clase.entity';
import { SociosService } from '../../m1-usuarios/services/socios.service';
import { ClaseRepository } from '../repositories/clase.repository';
import { ReservaClaseRepository } from '../repositories/reserva-clase.repository';

// RF-07: el importe de la penalidad por cancelacion tardia de una clase.
//
// Mismo patron que `ReservaPrecioService` (M4) y `MembresiaPrecioService` (M1):
// M5 importa este service para resolver el importe de un concepto que emite otro
// modulo, sin que M3 exponga toda su API. Es la unica pieza de M3 que M5 consume,
// y por eso es lo unico que `ClasesModule` exporta.
@Injectable()
export class ReservaClasePrecioService {
  constructor(
    private readonly reservasClases: ReservaClaseRepository,
    private readonly clases: ClaseRepository,
    // El Pago referencia a Usuario y la reserva lleva socioId: el cruce lo
    // resuelve M1 (duena de Socio) via SociosService, no M3.
    private readonly socios: SociosService,
  ) {}

  async obtenerParaCobro(reservaClaseId: number): Promise<ReservaClaseParaCobro | null> {
    const reserva = await this.reservasClases.buscarPorId(reservaClaseId);
    if (!reserva) {
      return null;
    }

    const clase = await this.clases.buscarPorId(reserva.claseId);
    if (!clase) {
      return null;
    }

    const usuarioId = await this.socios.obtenerUsuarioIdPorSocio(reserva.socioId);
    if (usuarioId === null) {
      return null;
    }

    return {
      reservaClaseId: reserva.id,
      socioId: reserva.socioId,
      usuarioId: usuarioId,
      claseId: reserva.claseId,
      horario: clase.horario,
      // La penalidad es dato del dominio (valor nominal * porcentaje): no depende
      // de la fila. Igual se devuelve por el tipo para que M5 no conozca la regla.
      penalidad: penalidadCancelacionTardia(),
    };
  }
}