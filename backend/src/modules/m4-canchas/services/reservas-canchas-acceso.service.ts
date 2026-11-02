import { Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { ListarReservasCanchasQueryDto } from '../dtos/listar-reservas-canchas-query.dto';
import { ReservaCanchaIn } from '../dtos/reserva-cancha-in.dto';
import { ReservaCanchaOut } from '../dtos/reserva-cancha-out.dto';
import {
  exigirReservaPropia,
  exigirUsuarioPropio,
  usuarioDelListado,
  veSoloLoPropio,
} from './alcance-reservas-canchas';
import { ReservasCanchasService } from './reservas-canchas.service';

/**
 * Lo que el controller de /reservas-canchas le pide a M4 en nombre de una persona con sesion: aplica el alcance por rol
 * (`alcance-reservas-canchas.ts`) y delega en `ReservasCanchasService`, que no sabe de quien llama. La cancelacion por
 * evento, el cobro de la reserva y el resto de los flujos internos no pasan por aca.
 */
@Injectable()
export class ReservasCanchasAccesoService {
  constructor(private readonly reservas: ReservasCanchasService) {}

  listar(
    actor: UsuarioAutenticado,
    query: ListarReservasCanchasQueryDto,
  ): ReturnType<ReservasCanchasService['listar']> {
    return this.reservas.listar({
      canchaId: query.canchaId,
      usuarioId: usuarioDelListado(actor, query.usuarioId),
      estado: query.estado,
      fecha: query.fecha,
      page: query.page ?? 1,
      perPage: query.perPage ?? 20,
    });
  }

  async crear(actor: UsuarioAutenticado, dto: ReservaCanchaIn): Promise<ReservaCanchaOut> {
    exigirUsuarioPropio(actor, dto.usuarioId);
    return this.reservas.crear(dto);
  }

  async obtener(actor: UsuarioAutenticado, id: number): Promise<ReservaCanchaOut> {
    const reserva = await this.reservas.obtener(id);
    exigirReservaPropia(actor, reserva.usuarioId);
    return reserva;
  }

  async cancelar(actor: UsuarioAutenticado, id: number): Promise<void> {
    // RECEPCION y GERENTE cancelan cualquiera: no hace falta leer la reserva antes (si no existe, cancelar responde el 404).
    if (veSoloLoPropio(actor)) {
      await this.obtener(actor, id);
    }
    return this.reservas.cancelar(id);
  }
}
