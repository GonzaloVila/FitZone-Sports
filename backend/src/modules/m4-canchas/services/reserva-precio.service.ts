import { Injectable } from '@nestjs/common';
import { ReservaRepository } from '../repositories/reserva.repository';

// Lo único que M5 necesita de una reserva para cobrar: el precio ya congelado, de
// quién es, cuándo se juega y si todavía se puede cobrar. Los ids y las fechas se los
// queda M4, que es su dueña; esto es la lectura mínima del caso de uso, no la entidad
// entera.
//
// `cancha_id` y las dos fechas están porque el comprobante en PDF (RF-14) lleva
// "cancha, horario y monto": sin ellas el PDF solo podría decir el monto. Salen de la
// MISMA fila que ya se leía para el precio, así que ampliar esta interfaz no suma una
// consulta ni cruza el límite de ADR-07 —M5 sigue sin escribir sobre la tabla Reserva—.
//
// Lo que NO se amplía, y por qué: el tipo de cancha. `Cancha` no tiene columna de
// nombre, así que el comprobante identifica la cancha por su número. Si alguna vez hace
// falta, el lugar del cruce es esta interfaz.
export interface ReservaParaCobro {
  reserva_id: number;
  usuario_id: number;
  cancha_id: number;
  fecha_hora_inicio: Date;
  fecha_hora_fin: Date;
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
      cancha_id: reserva.cancha_id,
      fecha_hora_inicio: reserva.fecha_hora_inicio,
      fecha_hora_fin: reserva.fecha_hora_fin,
      precio: reserva.precio_aplicado,
      estado: reserva.estado,
    };
  }
}