import { esErrorApiConEstado, mensajeDeError } from '@/compartido/http/errores'
import type { EstadoMembresia, Membresia, MembresiaPatch, Plan } from './services/servicioSocios'
import type { AccionFila, AccionSocio } from './tipos'

// Cómo se muestran los valores del contrato. Record<...> obliga a actualizar esto si el contrato agrega uno.
export const ETIQUETAS_ESTADO: Record<EstadoMembresia, string> = {
  ACTIVA: 'Activa',
  VENCIDA: 'Vencida',
  SUSPENDIDA: 'Suspendida',
}

export const VARIANTES_ESTADO: Record<EstadoMembresia, 'exito' | 'peligro' | 'advertencia'> = {
  ACTIVA: 'exito',
  VENCIDA: 'peligro',
  SUSPENDIDA: 'advertencia',
}

export const ETIQUETAS_PLAN: Record<Plan, string> = {
  MENSUAL: 'Mensual',
  TRIMESTRAL: 'Trimestral',
  ANUAL: 'Anual',
}

export const ESTADOS = Object.keys(ETIQUETAS_ESTADO) as EstadoMembresia[]
export const PLANES = Object.keys(ETIQUETAS_PLAN) as Plan[]

// Las fechas del contrato vienen con offset de la sede (-03:00): se muestran siempre en esa zona.
const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Argentina/Buenos_Aires',
})

export function formatearFecha(fechaIso: string): string {
  const fecha = new Date(fechaIso)
  return Number.isNaN(fecha.getTime()) ? fechaIso : FORMATO_FECHA.format(fecha)
}

export function formatearVigencia(inicioIso: string, finIso: string): string {
  return `${formatearFecha(inicioIso)} al ${formatearFecha(finIso)}`
}

// El período de la membresía ya terminó (aunque el estado todavía no se haya actualizado a VENCIDA).
export function periodoTerminado(fechaFinIso: string, ahora: Date = new Date()): boolean {
  return new Date(fechaFinIso).getTime() < ahora.getTime()
}

export function textoVigencia(membresia: Pick<Membresia, 'estado' | 'fechaFin'>, ahora: Date = new Date()): string {
  const fecha = formatearFecha(membresia.fechaFin)
  if (periodoTerminado(membresia.fechaFin, ahora)) return `Venció el ${fecha}`
  return membresia.estado === 'ACTIVA' ? `Vigente hasta ${fecha}` : `Período hasta ${fecha}`
}

const ACCIONES_FILA = ['ver-ficha', 'cambiar-plan', 'suspender', 'reactivar', 'dejar-de-ser-socio'] as const satisfies readonly AccionFila[]

export function esAccionFila(valor: unknown): valor is AccionFila {
  return ACCIONES_FILA.some((accion) => accion === valor)
}

// Regla única de qué acciones admite una membresía según su estado (null = membresía no disponible).
// Suspender solo desde ACTIVA. Reactivar solo desde SUSPENDIDA. Cambiar plan desde ACTIVA (cambia sin cobro) o
// desde VENCIDA (renueva: se cobra el plan nuevo); una SUSPENDIDA se reactiva primero.
// Las acciones que no dependen de la membresía (dejar de ser socio, cambiar sede) siempre se permiten.
export function accionPermitida(accion: AccionSocio, estadoMembresia: EstadoMembresia | null): boolean {
  switch (accion) {
    case 'suspender':
      return estadoMembresia === 'ACTIVA'
    case 'reactivar':
      return estadoMembresia === 'SUSPENDIDA'
    case 'cambiar-plan':
      return estadoMembresia === 'ACTIVA' || estadoMembresia === 'VENCIDA'
    case 'renovacion-automatica':
      return estadoMembresia !== null
    case 'cambiar-sede':
    case 'dejar-de-ser-socio':
      return true
  }
}

// Qué se manda al cambiar de plan. El backend cobra el plan nuevo a una membresía no vigente pero no le cambia el
// estado: para renovar una VENCIDA hay que pedir también que quede ACTIVA, en el mismo pedido.
export function cambiosParaPlan(plan: Plan, estadoMembresia: EstadoMembresia | null): MembresiaPatch {
  return estadoMembresia === 'VENCIDA' ? { plan, estado: 'ACTIVA' } : { plan }
}

// ACTIVA exige un plan distinto del actual (con el mismo se reiniciaría el período sin sentido). En VENCIDA vale
// cualquiera, incluido el actual: es renovar.
export function puedeConfirmarPlan(estadoMembresia: EstadoMembresia | null, planActual: Plan | null, planElegido: string): boolean {
  if (!PLANES.some((plan) => plan === planElegido)) return false
  if (estadoMembresia === 'ACTIVA') return planElegido !== planActual
  return estadoMembresia === 'VENCIDA'
}

export const DURACION_PLAN: Record<Plan, string> = {
  MENSUAL: '1 mes',
  TRIMESTRAL: '3 meses',
  ANUAL: '12 meses',
}

export const MENSAJE_COBRO_RECHAZADO = 'El cobro fue rechazado, no se hicieron cambios.'

// El 402 es el cobro rechazado de un cambio de plan sobre una membresía no vigente.
export function mensajeDeErrorDeMembresia(e: unknown, porDefecto: string): string {
  return esErrorApiConEstado(e, 402) ? MENSAJE_COBRO_RECHAZADO : mensajeDeError(e, porDefecto)
}
