import { comoTexto } from '@/compartido/comoTexto'
import { ESTADOS_CANCHA, ETIQUETA_TIPO_CANCHA, formatearMonto } from './presentacion'
import type { Cancha, CanchaPatch } from './services/servicioCanchas'

// Lo que se edita de una cancha, tal como lo entregan los campos (el costo puede llegar como número).
export interface FormularioEdicionCancha {
  costoPorHora: string
  estado: string
}

export const MENSAJE_COSTO_INVALIDO = 'Ingresá un costo por hora de cero o más.'
export const MENSAJE_SIN_CAMBIOS = 'No hay cambios para guardar: modificá el costo o el estado.'

export function formularioDe(cancha: Cancha): FormularioEdicionCancha {
  return { costoPorHora: String(cancha.costoPorHora), estado: cancha.estado }
}

// Validación de ayuda de uso: el servidor siempre decide.
export function validarEdicion(form: FormularioEdicionCancha): Record<string, string> {
  const errores: Record<string, string> = {}
  const costoTexto = comoTexto(form.costoPorHora)
  const costo = Number(costoTexto)
  if (costoTexto === '' || !Number.isFinite(costo) || costo < 0) errores.costoPorHora = MENSAJE_COSTO_INVALIDO
  if (!ESTADOS_CANCHA.some((estado) => estado === form.estado)) errores.estado = 'Elegí el estado de la cancha.'
  return errores
}

// Solo viaja lo que cambió (un PATCH sin campos es un 422). Vacío = no hay nada que guardar.
export function cambiosDe(cancha: Cancha, form: FormularioEdicionCancha): CanchaPatch {
  const cambios: CanchaPatch = {}
  const costo = Number(comoTexto(form.costoPorHora))
  if (costo !== cancha.costoPorHora) cambios.costoPorHora = costo
  const estado = ESTADOS_CANCHA.find((valor) => valor === form.estado)
  if (estado && estado !== cancha.estado) cambios.estado = estado
  return cambios
}

export function nombreDeCancha(cancha: Pick<Cancha, 'tipo' | 'id'>): string {
  return `${ETIQUETA_TIPO_CANCHA[cancha.tipo]} #${cancha.id}`
}

// Qué dice el aviso de éxito: qué se cambió, en palabras (no un genérico "guardado").
export function resumenDeCambios(antes: Cancha, despues: Cancha): { titulo: string; descripcion: string } {
  const partes: string[] = []
  if (despues.costoPorHora !== antes.costoPorHora) {
    partes.push(`El costo por hora pasó de ${formatearMonto(antes.costoPorHora)} a ${formatearMonto(despues.costoPorHora)}.`)
  }
  if (despues.estado !== antes.estado) {
    partes.push(despues.estado === 'EN_MANTENIMIENTO' ? 'La cancha pasó a mantenimiento.' : 'La cancha volvió a estar operativa.')
  }
  return { titulo: 'Cancha actualizada', descripcion: `${nombreDeCancha(despues)}. ${partes.join(' ')}`.trim() }
}
