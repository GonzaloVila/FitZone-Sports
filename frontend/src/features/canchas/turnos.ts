// Lógica pura de la pantalla de turnos de una cancha: los días de la tira, la fecha en la dirección, las franjas del día y el
// resumen. Las fechas se manejan como texto YYYY-MM-DD en la zona de la sede, sin pasar por la zona del navegador.
import { textoDe, type ConsultaCruda, type Parametros } from '@/compartido/parametrosDeDireccion'
import { formatearHora, type EstadoTurno } from './presentacion'
import type { Disponibilidad } from './services/servicioCanchas'

// ---- Días de la tira ----

export const DIAS_DE_LA_TIRA = 7

export interface DiaDeLaTira {
  // YYYY-MM-DD
  fecha: string
  // Lo que dice el botón: "Hoy", "Mañana" o el día ("vie 13").
  etiqueta: string
  // Para el lector de pantalla: "viernes 13 de noviembre".
  nombreCompleto: string
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

// Una fecha YYYY-MM-DD real (el 31 de febrero no existe); null si no lo es.
function partesDe(fecha: string): { anio: number; mes: number; dia: number } | null {
  const partes = FORMATO_FECHA.exec(fecha)
  if (!partes) return null
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])]
  const real = new Date(Date.UTC(anio, mes - 1, dia))
  const coincide = real.getUTCFullYear() === anio && real.getUTCMonth() === mes - 1 && real.getUTCDate() === dia
  return coincide ? { anio, mes, dia } : null
}

export const esFechaValida = (fecha: string): boolean => partesDe(fecha) !== null

// La fecha N días después (o antes, con un número negativo).
export function sumarDias(fecha: string, dias: number): string {
  const partes = partesDe(fecha)
  if (!partes) throw new RangeError(`Fecha inválida: ${fecha}`)
  return new Date(Date.UTC(partes.anio, partes.mes - 1, partes.dia + dias)).toISOString().slice(0, 10)
}

function etiquetaDe(fecha: string, indice: number): string {
  if (indice === 0) return 'Hoy'
  if (indice === 1) return 'Mañana'
  const partes = partesDe(fecha)!
  return `${DIAS_CORTOS[new Date(Date.UTC(partes.anio, partes.mes - 1, partes.dia)).getUTCDay()]} ${partes.dia}`
}

function nombreCompletoDe(fecha: string): string {
  const partes = partesDe(fecha)!
  const diaDeLaSemana = DIAS_LARGOS[new Date(Date.UTC(partes.anio, partes.mes - 1, partes.dia)).getUTCDay()]
  return `${diaDeLaSemana} ${partes.dia} de ${MESES[partes.mes - 1]}`
}

// Hoy y los días que siguen, hasta completar `cantidad`.
export function diasDeLaTira(hoy: string, cantidad = DIAS_DE_LA_TIRA): DiaDeLaTira[] {
  return Array.from({ length: cantidad }, (_, indice) => {
    const fecha = sumarDias(hoy, indice)
    return { fecha, etiqueta: etiquetaDe(fecha, indice), nombreCompleto: nombreCompletoDe(fecha) }
  })
}

// ---- La fecha en la dirección (?fecha=) ----

// La fecha que dice la dirección, solo si es una de las de la tira; si falta, es inválida, ya pasó o queda fuera de la tira,
// vale hoy (nunca rompe).
export function fechaDeTurnosDe(query: ConsultaCruda, hoy: string, cantidad = DIAS_DE_LA_TIRA): string {
  const fecha = textoDe(query, 'fecha')
  if (fecha === null || !esFechaValida(fecha)) return hoy
  return fecha >= hoy && fecha <= sumarDias(hoy, cantidad - 1) ? fecha : hoy
}

// Lo que se escribe en la dirección: hoy es el valor por defecto y no se escribe.
export function parametrosDeFecha(fecha: string, hoy: string): Parametros {
  return fecha === hoy ? {} : { fecha }
}

// La dirección actual sin la fecha, para escribir la nueva encima (queda el origen y los filtros de la lista).
export function sinFecha<T extends ConsultaCruda>(query: T): Partial<T> {
  const resto: Partial<T> = { ...query }
  delete resto.fecha
  return resto
}

// ---- Franjas del día ----

export type Franja = 'manana' | 'tarde' | 'noche'

export const ETIQUETA_FRANJA: Record<Franja, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' }

const ORDEN_FRANJAS: Franja[] = ['manana', 'tarde', 'noche']

// Mañana hasta las 12, tarde hasta las 19 y noche desde las 19, según la hora de la sede.
export function franjaDe(inicioIso: string): Franja {
  const hora = Number(formatearHora(inicioIso).slice(0, 2))
  if (hora < 12) return 'manana'
  return hora < 19 ? 'tarde' : 'noche'
}

export interface TurnoConEstado {
  turno: Disponibilidad
  estado: EstadoTurno
}

export interface GrupoDeTurnos {
  franja: Franja
  etiqueta: string
  turnos: TurnoConEstado[]
}

// Los turnos agrupados por franja y ordenados por hora; las franjas sin turnos no aparecen.
export function agruparPorFranja(
  turnos: readonly Disponibilidad[],
  estadoDe: (turno: Disponibilidad) => EstadoTurno,
): GrupoDeTurnos[] {
  const ordenados = [...turnos].sort((a, b) => new Date(a.fechaHoraInicio).getTime() - new Date(b.fechaHoraInicio).getTime())
  return ORDEN_FRANJAS.map((franja) => ({
    franja,
    etiqueta: ETIQUETA_FRANJA[franja],
    turnos: ordenados.filter((turno) => franjaDe(turno.fechaHoraInicio) === franja).map((turno) => ({ turno, estado: estadoDe(turno) })),
  })).filter((grupo) => grupo.turnos.length > 0)
}

// ---- Estado de cada turno, siempre con texto ----

export const ETIQUETA_ESTADO_TURNO: Record<EstadoTurno, string> = {
  libre: 'Libre',
  ocupado: 'Ocupado',
  mantenimiento: 'En mantenimiento',
  pasado: 'Ya pasó',
}

// ---- Resumen del día ----

export function resumenDeTurnos(turnos: readonly { estado: EstadoTurno }[]): string {
  const libres = turnos.filter((turno) => turno.estado === 'libre').length
  const ocupados = turnos.filter((turno) => turno.estado === 'ocupado').length
  return `${libres} ${libres === 1 ? 'libre' : 'libres'} · ${ocupados} ${ocupados === 1 ? 'ocupado' : 'ocupados'}`
}
