import { esErrorApiConEstado, mensajeDeError } from '@/compartido/http/errores'
import type { AccionMenuFz } from '@/ui'
import type { EstadoMembresia, Membresia, MembresiaPatch, Plan, Socio } from './services/servicioSocios'
import type {
  AccionConModal,
  AccionFicha,
  AccionFila,
  AccionSocio,
  ContextoMenuSocio,
  FilaSocio,
  Opcional,
} from './tipos'

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

const ACCIONES_FICHA = ['cambiar-plan', 'suspender', 'reactivar', 'dejar-de-ser-socio', 'cambiar-sede'] as const satisfies readonly AccionFicha[]

export function esAccionFicha(valor: unknown): valor is AccionFicha {
  return ACCIONES_FICHA.some((accion) => accion === valor)
}

// Ítems del menú "···" de un socio, con las reglas de habilitación de `accionPermitida`. La lista abre con "Ver ficha";
// la ficha, que ya está en ella, ofrece en cambio "Cambiar sede de origen" y separa "Dejar de ser socio" del resto.
// `estado` es null si la membresía no está disponible.
export function accionesDeMenuSocio(estado: EstadoMembresia | null, contexto: ContextoMenuSocio): AccionMenuFz[] {
  const cambiarPlan: AccionMenuFz = {
    clave: 'cambiar-plan',
    etiqueta: estado === 'VENCIDA' ? 'Renovar' : 'Cambiar plan',
    icono: 'cambiar',
    deshabilitada: !accionPermitida('cambiar-plan', estado),
  }
  const alternaEstado: AccionMenuFz =
    estado === 'SUSPENDIDA'
      ? { clave: 'reactivar', etiqueta: 'Reactivar', icono: 'reproducir', deshabilitada: !accionPermitida('reactivar', estado) }
      : { clave: 'suspender', etiqueta: 'Suspender', icono: 'pausa', deshabilitada: !accionPermitida('suspender', estado) }
  const baja: AccionMenuFz = { clave: 'dejar-de-ser-socio', etiqueta: 'Dejar de ser socio', icono: 'quitar-usuario', peligro: true }

  if (contexto === 'lista') return [{ clave: 'ver-ficha', etiqueta: 'Ver ficha', icono: 'ojo' }, cambiarPlan, alternaEstado, baja]
  return [cambiarPlan, alternaEstado, { clave: 'cambiar-sede', etiqueta: 'Cambiar sede de origen', icono: 'lugar' }, { ...baja, separada: true }]
}

export interface AvisoMembresia {
  tono: 'peligro' | 'advertencia'
  texto: string
  // El botón del aviso abre el mismo modal que el ítem del menú con esa clave.
  accion: { clave: Extract<AccionConModal, 'cambiar-plan' | 'reactivar'>; etiqueta: string; variante: 'primario' | 'advertencia' }
}

// Aviso de la ficha según el estado de la membresía; una ACTIVA no lleva ninguno.
export function avisoDeMembresia(membresia: Pick<Membresia, 'estado' | 'fechaFin'>): AvisoMembresia | null {
  switch (membresia.estado) {
    case 'VENCIDA':
      return {
        tono: 'peligro',
        texto: `La membresía venció el ${formatearFecha(membresia.fechaFin)}.`,
        accion: { clave: 'cambiar-plan', etiqueta: 'Renovar', variante: 'primario' },
      }
    case 'SUSPENDIDA':
      return {
        tono: 'advertencia',
        texto: 'La membresía está suspendida.',
        accion: { clave: 'reactivar', etiqueta: 'Reactivar', variante: 'advertencia' },
      }
    case 'ACTIVA':
      return null
  }
}

// La ficha tiene el socio y su membresía por separado; las acciones con modal trabajan sobre una fila de la lista.
export function filaDeSocio(socio: Socio, membresia: Opcional<Membresia>): FilaSocio {
  return {
    socio,
    membresia: membresia.situacion === 'disponible' ? { situacion: 'disponible', membresia: membresia.valor } : { situacion: membresia.situacion },
  }
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
