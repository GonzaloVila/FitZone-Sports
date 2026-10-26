export type EstadoOcupacion = 'disponible' | 'casi-lleno' | 'lleno'

// Estado de una sede según cuánta gente hay y cuánta cabe. Es la única regla de ocupación de la app: la insignia, el color
// del número y el de la barra salen de acá.
// - lleno: no quedan lugares (también si hay más gente que capacidad);
// - casi lleno: quedan pocos, es decir, a lo sumo el 10 % de la capacidad (redondeado hacia arriba) y nunca menos de 1,
//   y hay al menos una persona adentro: una sede vacía nunca está "casi llena", por chica que sea;
// - disponible: el resto.
export function estadoDeOcupacion(actual: number, maximo: number): EstadoOcupacion {
  const lugares = maximo - actual
  if (lugares <= 0) return 'lleno'
  return actual > 0 && lugares <= Math.max(1, Math.ceil(maximo / 10)) ? 'casi-lleno' : 'disponible'
}
