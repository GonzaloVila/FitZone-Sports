import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import type { ConceptoPago } from '../entities/pago.entity';

// Regla de alcance de /pagos, en un solo lugar y sin dependencias (funciones puras):
//  - SOCIO y EXTERNO ven y cobran solo lo propio.
//  - RECEPCION y GERENTE ven y cobran todo (cobro de mostrador). Los pagos no tienen sede directa, asi que no hay scope por sede.
// Lo ajeno responde 404, con el mismo error que "no existe": que un recurso de otro parezca inexistente.

export function veSoloLoPropio(actor: UsuarioAutenticado): boolean {
  return actor.rol === 'SOCIO' || actor.rol === 'EXTERNO';
}

// El usuario por el que se filtra el listado: para SOCIO y EXTERNO siempre el propio (lo que pidan se ignora).
export function usuarioDelListado(actor: UsuarioAutenticado, pedido: number | undefined): number | undefined {
  return veSoloLoPropio(actor) ? actor.userId : pedido;
}

// 404 si el pago es de otro usuario y quien consulta solo puede ver lo propio.
export function exigirPagoPropio(actor: UsuarioAutenticado, usuarioIdDelPago: number, pagoId: number): void {
  if (veSoloLoPropio(actor) && usuarioIdDelPago !== actor.userId) {
    throw recursoNoEncontrado(`No existe el pago ${pagoId}.`);
  }
}

// El mismo texto que PagosService.resolverConcepto usa cuando el concepto no existe.
export function detalleConceptoInexistente(concepto: ConceptoPago): string {
  if (concepto.tipo === 'RESERVA_CANCHA') return `No existe la reserva ${concepto.reservaCanchaId}.`;
  if (concepto.tipo === 'RESERVA_CLASE') return `No existe la reserva de clase ${concepto.reservaClaseId}.`;
  return `No existe la membresía ${concepto.membresiaId}.`;
}

// 404 si el concepto que se quiere cobrar es de otro usuario y quien cobra solo puede cobrar lo propio.
export function exigirConceptoPropio(
  actor: UsuarioAutenticado,
  usuarioIdDelConcepto: number,
  concepto: ConceptoPago,
): void {
  if (veSoloLoPropio(actor) && usuarioIdDelConcepto !== actor.userId) {
    throw recursoNoEncontrado(detalleConceptoInexistente(concepto));
  }
}
