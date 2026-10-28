import { nombreDeCancha } from './edicion'
import type { Cancha } from './services/servicioCanchas'

// id de la cancha → su etiqueta ("Fútbol 5 #2"), la misma que usa la lista de canchas.
export type EtiquetasCanchas = ReadonlyMap<number, string>

// `ReservaCanchaOut` no trae la cancha: para nombrarla en "Mis reservas" se arma este mapa con una sola consulta a la lista.
export function armarEtiquetasCanchas(canchas: Pick<Cancha, 'id' | 'tipo'>[]): EtiquetasCanchas {
  return new Map(canchas.map((cancha) => [cancha.id, nombreDeCancha(cancha)]))
}

// Una cancha que no está en el mapa (la consulta falló o no la trajo) cae a "Cancha #N".
export function etiquetaDeCancha(etiquetas: EtiquetasCanchas, canchaId: number): string {
  return etiquetas.get(canchaId) ?? `Cancha #${canchaId}`
}
