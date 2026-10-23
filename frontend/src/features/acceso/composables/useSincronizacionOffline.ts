import { ref, type Ref } from 'vue'
import { esErrorApi, mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { SincronizarIngresosIn, SincronizarIngresosOut } from '../services/servicioAcceso'

export interface ItemOffline {
  localId: number
  socioId: number
  codigoTotp: string
  fechaHoraIngreso: string
  tipo: 'ingreso' | 'egreso'
  ingresoLocalId?: number
}

const STORAGE_KEY = 'fitzone_accesos_offline'

export function useSincronizacionOffline(sedeId: Ref<number | null | undefined>) {
  const servicioAcceso = useServicios().acceso

  const cola = ref<ItemOffline[]>(cargarColaLocal())
  const sincronizando = ref(false)
  const resultadoLote = ref<SincronizarIngresosOut | null>(null)
  const error = ref<string | null>(null)

  function cargarColaLocal(): ItemOffline[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  function guardarColaLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cola.value))
    } catch {
      // Ignorar quota errors
    }
  }

  function agregarAccesoOffline(item: Omit<ItemOffline, 'localId' | 'fechaHoraIngreso'>) {
    const nuevo: ItemOffline = {
      ...item,
      localId: Date.now() + Math.floor(Math.random() * 1000),
      fechaHoraIngreso: new Date().toISOString(),
    }
    cola.value.push(nuevo)
    guardarColaLocal()
  }

  function limpiarCola() {
    cola.value = []
    guardarColaLocal()
  }

  async function sincronizar() {
    if (cola.value.length === 0) return

    sincronizando.value = true
    error.value = null
    resultadoLote.value = null

    try {
      const ingresosDto = cola.value
        .filter((c) => c.tipo === 'ingreso')
        .map((c) => ({
          localId: c.localId,
          socioId: c.socioId,
          codigoTotp: c.codigoTotp,
          fechaHoraIngreso: c.fechaHoraIngreso,
        }))

      const egresosDto = cola.value
        .filter((c) => c.tipo === 'egreso')
        .map((c) => ({
          localId: c.localId,
          ingresoLocalId: c.ingresoLocalId ?? c.localId,
          fechaHoraEgreso: c.fechaHoraIngreso,
        }))

      const payload: SincronizarIngresosIn = {
        ingresos: ingresosDto,
        egresos: egresosDto.length > 0 ? egresosDto : undefined,
      }

      const respuesta = await servicioAcceso.sincronizarIngresos(payload)
      resultadoLote.value = respuesta

      // Si todo fue procesado, limpiamos la cola
      limpiarCola()
    } catch (e) {
      error.value = mensajeDeError(e, 'No se pudo sincronizar el lote offline.')
    } finally {
      sincronizando.value = false
    }
  }

  return {
    cola,
    sincronizando,
    resultadoLote,
    error,
    agregarAccesoOffline,
    sincronizar,
    limpiarCola,
  }
}
