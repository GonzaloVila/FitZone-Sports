import type { EstadoMembresia, Plan } from './services/servicioSocios'
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

// Acciones que se resuelven en un modal de la ficha y que la lista puede pedir.
export const ACCIONES_CON_MODAL = ['cambiar-plan', 'suspender', 'reactivar', 'dejar-de-ser-socio'] as const satisfies readonly AccionSocio[]
export type AccionConModal = (typeof ACCIONES_CON_MODAL)[number]

export function esAccionConModal(valor: unknown): valor is AccionConModal {
  return ACCIONES_CON_MODAL.some((accion) => accion === valor)
}

export function esAccionFila(valor: unknown): valor is AccionFila {
  return valor === 'ver-ficha' || esAccionConModal(valor)
}

// Regla única de qué acciones admite una membresía según su estado (null = membresía no disponible).
// Suspender solo desde ACTIVA. Reactivar solo desde SUSPENDIDA: una VENCIDA se resuelve con "Cambiar plan".
// Las acciones que no dependen de la membresía (dejar de ser socio, cambiar sede) siempre se permiten.
export function accionPermitida(accion: AccionSocio, estadoMembresia: EstadoMembresia | null): boolean {
  switch (accion) {
    case 'suspender':
      return estadoMembresia === 'ACTIVA'
    case 'reactivar':
      return estadoMembresia === 'SUSPENDIDA'
    case 'cambiar-plan':
    case 'renovacion-automatica':
      return estadoMembresia !== null
    case 'cambiar-sede':
    case 'dejar-de-ser-socio':
      return true
  }
}
