// Lógica pura de la pantalla de turnos de una cancha: el día que se mira (en la dirección) y el estado de cada turno. Las fechas
// se manejan como texto YYYY-MM-DD en la zona de la sede, sin pasar por la zona del navegador.
import { textoDe, type ConsultaCruda, type Parametros } from '@/compartido/parametrosDeDireccion'
import type { Disponibilidad } from './services/servicioCanchas'

// ---- Fechas ----

// Se puede mirar hoy y los días que siguen, hasta completar esta cantidad (hoy + 6).
export const DIAS_PERMITIDOS = 7

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

// El último día que se puede mirar.
export const ultimaFecha = (hoy: string, cantidad = DIAS_PERMITIDOS): string => sumarDias(hoy, cantidad - 1)

// Una fecha real entre hoy y el último día permitido (inclusive).
export const fechaPermitida = (fecha: string, hoy: string, cantidad = DIAS_PERMITIDOS): boolean =>
  esFechaValida(fecha) && fecha >= hoy && fecha <= ultimaFecha(hoy, cantidad)

// ---- La fecha en la dirección (?fecha=) ----

// La fecha que dice la dirección, solo si está en el rango permitido; si falta, es inválida, ya pasó o queda fuera del rango,
// vale hoy (nunca rompe).
export function fechaDeTurnosDe(query: ConsultaCruda, hoy: string, cantidad = DIAS_PERMITIDOS): string {
  const fecha = textoDe(query, 'fecha')
  return fecha !== null && fechaPermitida(fecha, hoy, cantidad) ? fecha : hoy
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

// ---- Estado de cada turno ----

export type EstadoTurno = 'pasado' | 'libre' | 'ocupado'

export interface TurnoClasificado {
  turno: Disponibilidad
  estado: EstadoTurno
}

// Todos los turnos del día, por hora de inicio, cada uno pasado, libre u ocupado. Un turno que ya empezó (o pasó) es "pasado"
// aunque el servidor lo marque libre u ocupado: el pasado tiene prioridad, porque no se puede reservar y el servidor lo
// rechaza. Se compara el instante de inicio con `ahora`; como cada horario trae su offset (-03:00 de la sede), el corte es el
// de la hora de la sede aunque el navegador esté en otra zona.
export function clasificarTurnos(turnos: readonly Disponibilidad[], ahora: Date): TurnoClasificado[] {
  const instante = ahora.getTime()
  return [...turnos]
    .sort((a, b) => new Date(a.fechaHoraInicio).getTime() - new Date(b.fechaHoraInicio).getTime())
    .map((turno) => ({
      turno,
      estado: new Date(turno.fechaHoraInicio).getTime() <= instante ? 'pasado' : turno.disponible ? 'libre' : 'ocupado',
    }))
}
