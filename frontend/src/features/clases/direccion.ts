// El estado de la pantalla de Clases que vive en la dirección: los filtros de la agenda, su página y de dónde se llegó al
// detalle. Todo se valida al leerlo: un valor desconocido se ignora como si no estuviera (nunca rompe).

import {
  SEDE_TODAS,
  esEnteroPositivo,
  paginaDe,
  textoDe,
  type ConsultaCruda,
  type Parametros,
} from '@/compartido/parametrosDeDireccion'

// ---- Agenda: filtros y página ----

// Sin ?sede= la sede es la por defecto (la activa para el personal; todas para el socio); ?sede=todas es elegir todas.
export interface ConsultaAgenda {
  // Texto de la disciplina, sin espacios en los bordes ('' = sin filtro).
  tipo: string
  // null = el parámetro no está (la sede por defecto); '' = todas las sedes elegidas a propósito; si no, el id como texto.
  sede: string | null
  pagina: number
}

export function leerConsultaAgenda(query: ConsultaCruda): ConsultaAgenda {
  const sede = textoDe(query, 'sede')
  return {
    tipo: textoDe(query, 'tipo')?.trim() ?? '',
    sede: sede === SEDE_TODAS ? '' : sede !== null && esEnteroPositivo(sede) ? sede : null,
    pagina: paginaDe(query),
  }
}

// Lo que se escribe en la dirección: solo lo que se aparta de "ningún filtro, página 1, sede por defecto".
export function parametrosDeConsulta(consulta: ConsultaAgenda): Parametros {
  const parametros: Parametros = {}
  const tipo = consulta.tipo.trim()
  if (tipo) parametros.tipo = tipo
  if (consulta.sede !== null) parametros.sede = consulta.sede === '' ? SEDE_TODAS : consulta.sede
  if (consulta.pagina > 1) parametros.pagina = String(consulta.pagina)
  return parametros
}

// La dirección actual sin los parámetros de la agenda (queda, por ejemplo, la vista), para escribir los nuevos encima.
export function sinParametrosDeAgenda<T extends ConsultaCruda>(query: T): Partial<T> {
  const resto: Partial<T> = { ...query }
  delete resto.tipo
  delete resto.sede
  delete resto.pagina
  return resto
}

// ---- Detalle: de dónde se llegó ----

// Lista cerrada: cualquier otro valor de ?desde= se trata como entrada directa.
const ORIGENES = ['agenda', 'mis-clases'] as const
type OrigenDetalle = (typeof ORIGENES)[number]

// Parámetros del enlace al detalle: la agenda lleva sus filtros para poder reconstruirse al volver.
export function parametrosDesdeAgenda(consulta: ConsultaAgenda): Parametros {
  return { desde: 'agenda', ...parametrosDeConsulta(consulta) }
}

export const PARAMETROS_DESDE_MIS_CLASES: Readonly<Parametros> = { desde: 'mis-clases' }

export interface DestinoVolver {
  texto: string
  a: { name: 'clases'; query: Parametros }
}

// El enlace de "volver" del detalle, armado solo con la dirección (sin el historial del navegador): sirve igual al recargar
// o entrar por un enlace guardado. "Mis clases" es del socio: para los demás ese origen se ignora.
export function destinoVolver(query: ConsultaCruda, esSocio: boolean): DestinoVolver {
  const desde = textoDe(query, 'desde')
  const origen: OrigenDetalle | undefined = ORIGENES.find((valor) => valor === desde)
  if (origen === 'mis-clases' && esSocio) {
    return { texto: 'Volver a mis clases', a: { name: 'clases', query: { vista: 'mis-clases' } } }
  }
  const filtros = origen === 'agenda' ? parametrosDeConsulta(leerConsultaAgenda(query)) : {}
  return { texto: 'Volver a la agenda', a: { name: 'clases', query: filtros } }
}
