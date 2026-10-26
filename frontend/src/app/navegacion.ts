export interface EnlaceNavegacion {
  // Path del ítem del menú y nombre de su ruta (si la tiene).
  ruta: string
  nombre?: string | symbol
}

export interface RutaActual {
  path: string
  // `meta.activaEnNavegacion` de la ruta actual: nombre de la ruta del ítem del menú al que pertenece.
  activaEn?: string
}

// ¿Este ítem del menú está activo en la ruta actual? Devuelve el valor de `aria-current`:
// 'page' si es la pantalla del ítem, 'true' si es una pantalla de adentro de su sección (la ruta cuelga de su path
// o declara en su meta que pertenece a ese ítem) y undefined si no.
export function marcaDeEnlace(enlace: EnlaceNavegacion, actual: RutaActual): 'page' | 'true' | undefined {
  if (actual.path === enlace.ruta) return 'page'
  if (actual.path.startsWith(`${enlace.ruta}/`)) return 'true'
  if (actual.activaEn !== undefined && actual.activaEn === enlace.nombre) return 'true'
  return undefined
}
