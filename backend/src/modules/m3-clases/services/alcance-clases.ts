import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { exigirSedePropia } from '../../m2-gimnasio/services/alcance-ingresos';
import { sinSocioEnLaSesion } from '../errors/acceso.errors';

// Regla de alcance de /clases, /reservas-clases y /esperas-clases, en un solo lugar y sin dependencias (funciones puras).
// Quién entra a cada endpoint (SOCIO, RECEPCION y GERENTE; el EXTERNO nunca) lo decide @Roles en el controller; acá queda
// lo que depende de a quién se refiere el pedido:
//  - El SOCIO reserva, se anota y ve solo lo suyo: su `socioId` es el del token. Lo ajeno responde 404, con el mismo texto
//    que "no existe". Si el token no trae `socioId`, no tiene "lo propio": 403 en listados y altas, 404 en recursos por id.
//  - RECEPCION y GERENTE ven y operan todo, también reservando por cualquier socio. Las reservas y esperas cuelgan de la
//    clase, no de una sede propia, así que solo se acota la sede de RECEPCION al crear una clase.
export const DETALLE_NO_EXISTE = 'No existe el recurso solicitado para el id indicado.';
// El mismo texto que da la reserva cuando el socio no existe (SocioAlDia) y la espera (EsperasClasesService).
export const DETALLE_SOCIO_NO_EXISTE = 'El socio indicado no existe.';

export function esSocio(actor: UsuarioAutenticado): boolean {
  return actor.rol === 'SOCIO';
}

// El socio por el que se filtra un listado: para SOCIO siempre el del token (lo que pida se ignora); RECEPCION y GERENTE
// conservan lo que piden. 403 si es un SOCIO sin `socioId` en el token.
export function socioDelListado(actor: UsuarioAutenticado, pedido: number | undefined): number | undefined {
  if (!esSocio(actor)) return pedido;
  if (actor.socioId === undefined) throw sinSocioEnLaSesion();
  return actor.socioId;
}

// Quien reserva o se anota por un socio: el SOCIO solo por sí mismo (404 si manda otro `socioId`, 403 si el token no trae el
// suyo); RECEPCION y GERENTE por cualquiera.
export function exigirSocioDelAlta(actor: UsuarioAutenticado, socioId: number): void {
  if (!esSocio(actor)) return;
  if (actor.socioId === undefined) throw sinSocioEnLaSesion();
  if (socioId !== actor.socioId) throw recursoNoEncontrado(DETALLE_SOCIO_NO_EXISTE);
}

// 404 si la reserva o la espera es de otro socio y quien consulta, cancela o confirma es un SOCIO.
export function exigirDelSocioPropio(actor: UsuarioAutenticado, socioIdDelRecurso: number): void {
  if (esSocio(actor) && (actor.socioId === undefined || socioIdDelRecurso !== actor.socioId)) {
    throw recursoNoEncontrado(DETALLE_NO_EXISTE);
  }
}

// 403 si un RECEPCION da de alta una clase en una sede que no es la suya (misma regla y texto que el aforo y el alta de
// ingreso de M2). GERENTE crea en cualquiera.
export function exigirSedeDeLaClase(actor: UsuarioAutenticado, sedeId: number): void {
  exigirSedePropia(actor, sedeId);
}
