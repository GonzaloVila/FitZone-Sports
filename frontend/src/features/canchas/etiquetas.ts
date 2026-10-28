import { nombreDeCancha } from './edicion'
import type { Cancha } from './services/servicioCanchas'

// Lo que "Mis reservas" necesita de cada cancha y la reserva no trae: su etiqueta ("Fútbol 5 #2", la misma que usa la lista de
// canchas) y la sede en la que está.
export interface DatosDeCancha {
  etiqueta: string
  sedeId: number
}

// id de la cancha → sus datos.
export type DatosDeCanchas = ReadonlyMap<number, DatosDeCancha>

// `ReservaCanchaOut` no trae la cancha: para nombrarla y ubicarla en "Mis reservas" se arma este mapa con una sola consulta a
// la lista.
export function armarDatosDeCanchas(canchas: Pick<Cancha, 'id' | 'tipo' | 'sedeId'>[]): DatosDeCanchas {
  return new Map(canchas.map((cancha) => [cancha.id, { etiqueta: nombreDeCancha(cancha), sedeId: cancha.sedeId }]))
}

// Una cancha que no está en el mapa (la consulta falló o no la trajo) cae a "Cancha #N".
export function etiquetaDeCancha(datos: DatosDeCanchas, canchaId: number): string {
  return datos.get(canchaId)?.etiqueta ?? `Cancha #${canchaId}`
}

// La sede de la cancha, o null si no se sabe cuál es.
export function sedeDeCancha(datos: DatosDeCanchas, canchaId: number): number | null {
  return datos.get(canchaId)?.sedeId ?? null
}
