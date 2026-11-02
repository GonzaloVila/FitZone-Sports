import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';

// Regla de alcance de /reservas-canchas, en un solo lugar y sin dependencias (funciones puras):
//  - SOCIO y EXTERNO ven, reservan y cancelan solo lo propio (la reserva es del `usuarioId`, que es el `userId` del token).
//  - RECEPCION y GERENTE ven y operan todo: la grilla de turnos lista reservas ajenas por cancha y día. Las reservas no tienen
//    sede propia (cuelgan de la cancha), así que no hay alcance por sede.
// Lo ajeno responde 404, con el mismo texto que "no existe": que un recurso de otro parezca inexistente.
export const DETALLE_NO_EXISTE = 'No existe el recurso solicitado para el id indicado.';

export function veSoloLoPropio(actor: UsuarioAutenticado): boolean {
  return actor.rol === 'SOCIO' || actor.rol === 'EXTERNO';
}

// El usuario por el que se filtra el listado: para SOCIO y EXTERNO siempre el propio (lo que pidan se ignora).
export function usuarioDelListado(actor: UsuarioAutenticado, pedido: number | undefined): number | undefined {
  return veSoloLoPropio(actor) ? actor.userId : pedido;
}

// 404 si quien reserva solo puede hacerlo a su nombre y el `usuarioId` del body es de otro.
export function exigirUsuarioPropio(actor: UsuarioAutenticado, usuarioId: number): void {
  if (veSoloLoPropio(actor) && usuarioId !== actor.userId) {
    throw recursoNoEncontrado(DETALLE_NO_EXISTE);
  }
}

// 404 si la reserva es de otro usuario y quien consulta o cancela solo puede ver lo propio.
export function exigirReservaPropia(actor: UsuarioAutenticado, usuarioIdDeLaReserva: number): void {
  exigirUsuarioPropio(actor, usuarioIdDeLaReserva);
}
