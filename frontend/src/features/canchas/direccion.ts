// El estado de la pantalla de Canchas que vive en la dirección: los filtros de la lista, su página y de dónde se llegó a la
// grilla de turnos. Todo se valida al leerlo: un valor desconocido se ignora como si no estuviera (nunca rompe).
import {
  esEnteroPositivo,
  paginaDe,
  textoDe,
  type ConsultaCruda,
  type Parametros,
} from '@/compartido/parametrosDeDireccion'
import { ESTADOS_CANCHA } from './presentacion'

// ---- Lista de canchas: filtros y página ----

export interface ConsultaCanchas {
  // null = el parámetro no está (la sede por defecto: la activa); si no, el id como texto. Las canchas se piden siempre de
  // una sede, así que no hay "todas".
  sede: string | null
  // Un EstadoCancha, o '' = sin filtro.
  estado: string
  pagina: number
}

export function leerConsultaCanchas(query: ConsultaCruda): ConsultaCanchas {
  const sede = textoDe(query, 'sede')
  const estado = textoDe(query, 'estado')
  return {
    sede: sede !== null && esEnteroPositivo(sede) ? sede : null,
    estado: ESTADOS_CANCHA.find((valor) => valor === estado) ?? '',
    pagina: paginaDe(query),
  }
}

// Lo que se escribe en la dirección: solo lo que se aparta de "sede por defecto, todos los estados, página 1".
export function parametrosDeConsultaCanchas(consulta: ConsultaCanchas): Parametros {
  const parametros: Parametros = {}
  if (consulta.sede !== null) parametros.sede = consulta.sede
  if (consulta.estado) parametros.estado = consulta.estado
  if (consulta.pagina > 1) parametros.pagina = String(consulta.pagina)
  return parametros
}

// La dirección actual sin los parámetros de la lista (queda, por ejemplo, la vista), para escribir los nuevos encima.
export function sinParametrosDeCanchas<T extends ConsultaCruda>(query: T): Partial<T> {
  const resto: Partial<T> = { ...query }
  delete resto.sede
  delete resto.estado
  delete resto.pagina
  return resto
}

// ---- Grilla de turnos: de dónde se llegó ----

// Lista cerrada: cualquier otro valor de ?desde= se trata como entrada directa.
const ORIGENES = ['canchas', 'mis-reservas'] as const
type OrigenGrilla = (typeof ORIGENES)[number]

// Parámetros del enlace a la grilla: la lista lleva sus filtros para poder reconstruirse al volver.
export function parametrosDesdeCanchas(consulta: ConsultaCanchas): Parametros {
  return { desde: 'canchas', ...parametrosDeConsultaCanchas(consulta) }
}

export const PARAMETROS_DESDE_MIS_RESERVAS: Readonly<Parametros> = { desde: 'mis-reservas' }

export interface DestinoVolver {
  texto: string
  a: { name: 'canchas'; query: Parametros }
}

// El enlace de "volver" de la grilla, armado solo con la dirección (sin el historial del navegador): sirve igual al
// recargar o entrar por un enlace guardado. "Mis reservas" es de quien reserva: para los demás ese origen se ignora.
export function destinoVolver(query: ConsultaCruda, tieneMisReservas: boolean): DestinoVolver {
  const desde = textoDe(query, 'desde')
  const origen: OrigenGrilla | undefined = ORIGENES.find((valor) => valor === desde)
  if (origen === 'mis-reservas' && tieneMisReservas) {
    return { texto: 'Volver a mis reservas', a: { name: 'canchas', query: { vista: 'mis-reservas' } } }
  }
  const filtros = origen === 'canchas' ? parametrosDeConsultaCanchas(leerConsultaCanchas(query)) : {}
  return { texto: 'Volver a canchas', a: { name: 'canchas', query: filtros } }
}
