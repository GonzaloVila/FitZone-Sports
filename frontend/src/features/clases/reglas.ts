import type { Clase } from './services/servicioClases'

const MS_HORA = 60 * 60 * 1000

// Ventana de reserva (RF-07): hasta 48 hs antes del inicio. El servidor es quien decide; esto solo anticipa el motivo.
export const HORAS_VENTANA_RESERVA = 48
// Cancelación sin cargo hasta 2 hs antes del inicio; después se cobra penalidad.
export const HORAS_SIN_PENALIDAD = 2

export const MOTIVO_VENTANA_NO_ABIERTA = 'La reserva se abre 48 hs antes'
export const MOTIVO_CLASE_COMENZADA = 'La clase ya comenzó'

export type MomentoDeClase = 'comenzada' | 'ventana-cerrada' | 'ventana-abierta'

export function momentoDeClase(clase: Pick<Clase, 'horarioInicio'>, ahora: number): MomentoDeClase {
  const inicio = new Date(clase.horarioInicio).getTime()
  if (ahora >= inicio) return 'comenzada'
  if (inicio - ahora > HORAS_VENTANA_RESERVA * MS_HORA) return 'ventana-cerrada'
  return 'ventana-abierta'
}

export const MENSAJE_FECHA_PASADA = 'Elegí un día y una hora que no hayan pasado.'

// Día de hoy (YYYY-MM-DD) según la hora local del navegador: lo que espera un <input type="date"> (y su `min`).
export function diaLocal(ahora: number): string {
  const fecha = new Date(ahora)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

// Campo del formulario de alta donde corresponde marcar que el inicio ya pasó, según la hora local del navegador
// (el servidor puede usar otra zona y sigue decidiendo): el día si es anterior a hoy; la hora de inicio si el día es hoy.
// Con el día vacío no hay nada que comparar.
export function campoConInicioPasado(dia: string, horaInicio: string, ahora: number): 'dia' | 'horaInicio' | null {
  if (!dia) return null
  const hoy = diaLocal(ahora)
  if (dia < hoy) return 'dia'
  if (dia > hoy || !horaInicio) return null
  const inicio = new Date(`${dia}T${horaInicio}`).getTime()
  return inicio < ahora ? 'horaInicio' : null
}

// Los listados de reservas y esperas (de la clase y del socio) traen también las ya canceladas, aunque el contrato diga que
// sin `estado` son solo las vigentes: acá se descartan en el cliente.
export function reservaVigente<T extends { estado: string }>(reservas: readonly T[]): T | null {
  return reservas.find((reserva) => reserva.estado === 'CONFIRMADA') ?? null
}

const esEsperaVigente = (espera: { estado: string }) => espera.estado === 'EN_ESPERA' || espera.estado === 'NOTIFICADO'

export function esperaVigente<T extends { estado: string }>(esperas: readonly T[]): T | null {
  return esperas.find(esEsperaVigente) ?? null
}

// La cola de una clase solo con las esperas vivas (EN_ESPERA y NOTIFICADO), en el orden en que las devuelve el servidor.
export function esperasVigentes<T extends { estado: string }>(esperas: readonly T[]): T[] {
  return esperas.filter(esEsperaVigente)
}

// Ocupación de una clase: las reservas no canceladas (las cumplidas de una clase ya dada siguen siendo inscriptos).
export function inscriptosVigentes<T extends { estado: string }>(reservas: readonly T[]): T[] {
  return reservas.filter((reserva) => reserva.estado !== 'CANCELADA')
}

export interface PaginaDeFilas<T> {
  items: T[]
  // La página ya acotada: si la pedida supera el total (la lista se achicó) es la última válida.
  pagina: number
  totalPaginas: number
  // Posición (desde 1) de la primera y la última fila de la página, para "Mostrando X a Y de Z"; 0 y 0 si no hay filas.
  desde: number
  hasta: number
  total: number
}

// Pagina una lista que ya está en el cliente ("Pasadas" de Mis clases: el servidor no la pagina por separado).
export function paginar<T>(filas: readonly T[], pagina: number, porPagina: number): PaginaDeFilas<T> {
  const total = filas.length
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const acotada = Math.min(Math.max(1, Math.trunc(pagina) || 1), totalPaginas)
  const inicio = (acotada - 1) * porPagina
  const items = filas.slice(inicio, inicio + porPagina)
  return {
    items,
    pagina: acotada,
    totalPaginas,
    desde: total === 0 ? 0 : inicio + 1,
    hasta: inicio + items.length,
    total,
  }
}

// Faltan menos de 2 hs (y la clase no comenzó): la cancelación tiene penalidad (la calcula y cobra el servidor).
export function cancelacionConPenalidad(clase: Pick<Clase, 'horarioInicio'>, ahora: number): boolean {
  const inicio = new Date(clase.horarioInicio).getTime()
  return ahora < inicio && inicio - ahora < HORAS_SIN_PENALIDAD * MS_HORA
}
