import { Injectable } from '@nestjs/common';
import { ReservaRepository } from '../repositories/reserva.repository';

// Lo unico que M5 necesita de una reserva para cobrar: el precio ya congelado, de
// quien es y si todavia se puede cobrar. Los ids y las fechas se los queda M4, que
// es su dueña; esto es la lectura minima del caso de uso, no la entidad entera.
export interface ReservaParaCobro {
  reserva_id: number;
  usuario_id: number;
  precio: number;
  estado: 'CONFIRMADA' | 'CANCELADA';
}

// Exportado desde CanchasModule para que M5 lea el precio congelado sin que M5
// escriba una consulta sobre la tabla Reserva: ADR-07 deja cada tabla con un solo
// lugar donde se consultan sus filas, y ese lugar es ReservaRepository, adentro de
// M4. Por eso este service no tiene Prisma: solo orquesta el repositorio y devuelve
// el tipo de arriba.
@Injectable()
export class ReservaPrecioService {
  constructor(private readonly reservas: ReservaRepository) {}

  // Devuelve null cuando la reserva no existe, para que el service de M5 lo traduzca
  // a 404 con su propio problem type en vez de propagar hacia afuera una excepcion
  // de M4.
  async obtenerParaCobro(reservaId: number): Promise<ReservaParaCobro | null> {
    const reserva = await this.reservas.buscarPorId(reservaId);
    if (!reserva) {
      return null;
    }

    return {
      reserva_id: reserva.id,
      usuario_id: reserva.usuario_id,
      precio: reserva.precio_aplicado,
      estado: reserva.estado,
    };
  }
}