import type { ContextoDePrecio } from './contexto-de-precio';

// Una regla de precio (patron Strategy, RF-11 / ADR-06): decide si le toca (aplica)
// y como transforma el precio acumulado (aplicar). Como las reglas se ACUMULAN
// (descuento Y ADEMAS recargo), la cadena es, en rigor, una cadena de decoradores
// (criterio de la catedra, Unidad III Clase 1 §6.3).
export interface ReglaDePrecio {
  aplica(ctx: ContextoDePrecio): boolean;
  aplicar(precio: number, ctx: ContextoDePrecio): number;
}

// Token de la coleccion ordenada de reglas. En NestJS el token de coleccion se
// declara con `useFactory` en el modulo; en Spring `List<ReglaDePrecio>` se inyecta
// sola y el orden lo fija @Order. El patron es el mismo, el contenedor no.
export const REGLAS_DE_PRECIO = Symbol('REGLAS_DE_PRECIO');
