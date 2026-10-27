// El estado del listado de Personal que vive en la dirección: la sede, el filtro por nombre y la página. Todo se valida al
// leerlo: un valor desconocido se ignora como si no estuviera (nunca rompe).
import { SEDE_TODAS, esEnteroPositivo, paginaDe, textoDe, type ConsultaCruda, type Parametros } from '@/compartido/parametrosDeDireccion'

export interface ConsultaPersonal {
  // '' = todas las sedes (el valor por defecto, sin parámetro); si no, el id de la sede como texto.
  sede: string
  // Texto del nombre, sin espacios en los bordes ('' = sin filtro).
  nombre: string
  pagina: number
}

export function leerConsultaPersonal(query: ConsultaCruda): ConsultaPersonal {
  const sede = textoDe(query, 'sede')
  return {
    sede: sede !== null && sede !== SEDE_TODAS && esEnteroPositivo(sede) ? sede : '',
    nombre: textoDe(query, 'nombre')?.trim() ?? '',
    pagina: paginaDe(query),
  }
}

// Lo que se escribe en la dirección: solo lo que se aparta de "todas las sedes, sin filtro, página 1".
export function parametrosDeConsultaPersonal(consulta: ConsultaPersonal): Parametros {
  const parametros: Parametros = {}
  if (consulta.sede) parametros.sede = consulta.sede
  const nombre = consulta.nombre.trim()
  if (nombre) parametros.nombre = nombre
  if (consulta.pagina > 1) parametros.pagina = String(consulta.pagina)
  return parametros
}

// La dirección actual sin los parámetros del listado, para escribir los nuevos encima.
export function sinParametrosDePersonal<T extends ConsultaCruda>(query: T): Partial<T> {
  const resto: Partial<T> = { ...query }
  delete resto.sede
  delete resto.nombre
  delete resto.pagina
  return resto
}
