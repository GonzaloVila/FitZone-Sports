import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import type { RolAlta, RolUsuario } from '../entities/usuario.entity';
import { sinPermisoParaCrearRol, sinPermisoParaModificarUsuario } from '../errors/usuarios.errors';

// Reglas de alcance de /usuarios, /socios y /socios/{socioId}/membresias, en un solo lugar y sin dependencias
// (funciones puras). Quién puede usar cada endpoint (RECEPCION y GERENTE, o cualquiera) lo decide @Roles en el controller;
// acá queda lo que depende de a quién se refiere el pedido:
//  - SOCIO y EXTERNO ven solo lo propio: su usuario, y (SOCIO) su socio y su membresía. Lo ajeno responde 404, con el mismo
//    texto que "no existe". El EXTERNO no tiene `socioId`, así que todo socio le es ajeno.
//  - RECEPCION crea solo EXTERNO y modifica solo a SOCIO y EXTERNO. GERENTE crea y modifica a cualquiera.
export const DETALLE_NO_EXISTE = 'No existe el recurso solicitado para el id indicado.';
export const DETALLE_SOCIO_NO_EXISTE = 'No existe el socio indicado.';

const ROLES_QUE_CREA_RECEPCION: readonly RolAlta[] = ['EXTERNO'];
const ROLES_PROTEGIDOS_DE_RECEPCION: readonly RolUsuario[] = ['RECEPCION', 'GERENTE'];

export function veSoloLoPropio(actor: UsuarioAutenticado): boolean {
  return actor.rol === 'SOCIO' || actor.rol === 'EXTERNO';
}

// 403 si el rol del alta no está entre los que puede crear quien la pide. S y E no llegan (el controller los frena).
export function exigirPuedeCrearRol(actor: UsuarioAutenticado, rolNuevo: RolAlta): void {
  if (actor.rol === 'GERENTE') return;
  if (actor.rol === 'RECEPCION' && ROLES_QUE_CREA_RECEPCION.includes(rolNuevo)) return;
  throw sinPermisoParaCrearRol(rolNuevo);
}

// true si el actor necesita conocer el rol del usuario objetivo para decidir (solo RECEPCION).
export function necesitaRolDelObjetivo(actor: UsuarioAutenticado): boolean {
  return actor.rol === 'RECEPCION';
}

// 403 si RECEPCION quiere modificar a un RECEPCION o un GERENTE (incluido él mismo). GERENTE modifica a cualquiera.
export function exigirPuedeModificar(actor: UsuarioAutenticado, usuarioId: number, rolDelObjetivo: RolUsuario): void {
  if (actor.rol === 'RECEPCION' && ROLES_PROTEGIDOS_DE_RECEPCION.includes(rolDelObjetivo)) {
    throw sinPermisoParaModificarUsuario(usuarioId);
  }
}

// 404 si quien consulta solo ve lo propio y el usuario es otro.
export function exigirUsuarioPropio(actor: UsuarioAutenticado, usuarioId: number): void {
  if (veSoloLoPropio(actor) && usuarioId !== actor.userId) {
    throw recursoNoEncontrado(DETALLE_NO_EXISTE);
  }
}

// 404 si quien consulta solo ve lo propio y el socio no es el suyo (el EXTERNO no tiene socio). `detalle` es el texto
// del 404 de "no existe" de cada endpoint.
export function exigirSocioPropio(actor: UsuarioAutenticado, socioId: number, detalle: string): void {
  if (veSoloLoPropio(actor) && (actor.socioId === undefined || socioId !== actor.socioId)) {
    throw recursoNoEncontrado(detalle);
  }
}
