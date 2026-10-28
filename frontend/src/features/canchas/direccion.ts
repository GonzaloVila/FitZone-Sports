// El estado de la pantalla de Canchas que vive en la dirección: los filtros de la lista, su página y de dónde se llegó a la
// grilla de turnos. Todo se valida al leerlo: un valor desconocido se ignora como si no estuviera (nunca rompe).
import {
  SEDE_TODAS,
  esEnteroPositivo,
  paginaDe,
  textoDe,
  type ConsultaCruda,
  type Parametros,
} from '@/compartido/parametrosDeDireccion'
import { ESTADOS_CANCHA, PESTANAS_RESERVAS, TIPOS_CANCHA, type PestanaReservas } from './presentacion'

// ---- Lista de canchas: filtros y página ----

export interface ConsultaCanchas {
  // null = el parámetro no está (la sede por defecto: todas, o la fija del RECEPCION); '' = todas las sedes elegidas a
  // propósito; si no, el id como texto.
  sede: string | null
  // Un TipoCancha (el deporte), o '' = todos los deportes.
  tipo: string
  // Un EstadoCancha, o '' = sin filtro.
  estado: string
  pagina: number
}

export function leerConsultaCanchas(query: ConsultaCruda): ConsultaCanchas {
  const sede = textoDe(query, 'sede')
  const tipo = textoDe(query, 'tipo')
  const estado = textoDe(query, 'estado')
  return {
    sede: sede === SEDE_TODAS ? '' : sede !== null && esEnteroPositivo(sede) ? sede : null,
    tipo: TIPOS_CANCHA.find((valor) => valor === tipo) ?? '',
    estado: ESTADOS_CANCHA.find((valor) => valor === estado) ?? '',
    pagina: paginaDe(query),
  }
}

// Lo que se escribe en la dirección: solo lo que se aparta de "sede por defecto, todos los deportes y estados, página 1".
export function parametrosDeConsultaCanchas(consulta: ConsultaCanchas): Parametros {
  const parametros: Parametros = {}
  if (consulta.sede !== null) parametros.sede = consulta.sede === '' ? SEDE_TODAS : consulta.sede
  if (consulta.tipo) parametros.tipo = consulta.tipo
  if (consulta.estado) parametros.estado = consulta.estado
  if (consulta.pagina > 1) parametros.pagina = String(consulta.pagina)
  return parametros
}

// La dirección actual sin los parámetros de la lista (queda, por ejemplo, la vista), para escribir los nuevos encima.
export function sinParametrosDeCanchas<T extends ConsultaCruda>(query: T): Partial<T> {
  const resto: Partial<T> = { ...query }
  delete resto.sede
  delete resto.tipo
  delete resto.estado
  delete resto.pagina
  return resto
}

// ---- Mis reservas: pestaña, página y reserva a pagar ----

// La página lleva su propio nombre: `pagina` es la de la lista de canchas y las dos vistas comparten la dirección.
const PARAMETRO_PESTANA = 'pestana'
const PARAMETRO_PAGINA = 'pagina-reservas'
const PARAMETRO_PAGAR = 'pagar'

export interface ConsultaMisReservas {
  pestana: PestanaReservas
  pagina: number
}

export function leerConsultaMisReservas(query: ConsultaCruda): ConsultaMisReservas {
  const pestana = textoDe(query, PARAMETRO_PESTANA)
  const pagina = textoDe(query, PARAMETRO_PAGINA)
  return {
    pestana: PESTANAS_RESERVAS.find((valor) => valor === pestana) ?? 'proximas',
    pagina: pagina !== null && esEnteroPositivo(pagina) ? Number(pagina) : 1,
  }
}

// Solo lo que se aparta de "Próximas, página 1".
export function parametrosDeConsultaMisReservas(consulta: ConsultaMisReservas): Parametros {
  const parametros: Parametros = {}
  if (consulta.pestana !== 'proximas') parametros[PARAMETRO_PESTANA] = consulta.pestana
  if (consulta.pagina > 1) parametros[PARAMETRO_PAGINA] = String(consulta.pagina)
  return parametros
}

// La dirección sin la pestaña ni la página (queda, por ejemplo, la vista o la reserva a pagar), para escribir las nuevas.
export function sinParametrosDeMisReservas<T extends ConsultaCruda>(query: T): Partial<T> {
  const resto: Partial<T> = { ...query }
  delete resto[PARAMETRO_PESTANA]
  delete resto[PARAMETRO_PAGINA]
  return resto
}

// Al salir de "Mis reservas" no queda nada de ella en la dirección.
export function sinParametrosDeVistaMisReservas<T extends ConsultaCruda>(query: T): Partial<T> {
  const resto = sinParametrosDeMisReservas(query)
  delete resto[PARAMETRO_PAGAR]
  return resto
}

// ?pagar=<id de la reserva>: abre el modal de pago de esa reserva. Un valor inválido se ignora.
export function reservaAPagarDe(query: ConsultaCruda): number | null {
  const id = textoDe(query, PARAMETRO_PAGAR)
  return id !== null && esEnteroPositivo(id) ? Number(id) : null
}

export function sinReservaAPagar<T extends ConsultaCruda>(query: T): Partial<T> {
  const resto: Partial<T> = { ...query }
  delete resto[PARAMETRO_PAGAR]
  return resto
}

// ---- Grilla de turnos: de dónde se llegó ----

// Es el único origen: cualquier otro valor de ?desde= se trata como entrada directa.
const ORIGEN_LISTA = 'canchas'

// Parámetros del enlace a la grilla: la lista lleva sus filtros para poder reconstruirse al volver.
export function parametrosDesdeCanchas(consulta: ConsultaCanchas): Parametros {
  return { desde: ORIGEN_LISTA, ...parametrosDeConsultaCanchas(consulta) }
}

export interface DestinoVolver {
  texto: string
  a: { name: 'canchas'; query: Parametros }
}

// El enlace de "volver" de la grilla, armado solo con la dirección (sin el historial del navegador): sirve igual al
// recargar o entrar por un enlace guardado.
export function destinoVolver(query: ConsultaCruda): DestinoVolver {
  const filtros = textoDe(query, 'desde') === ORIGEN_LISTA ? parametrosDeConsultaCanchas(leerConsultaCanchas(query)) : {}
  return { texto: 'Volver a canchas', a: { name: 'canchas', query: filtros } }
}
