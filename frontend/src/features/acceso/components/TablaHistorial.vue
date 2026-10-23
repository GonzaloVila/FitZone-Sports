<script setup lang="ts">
import { InsigniaFz, PaginacionFz, TablaFz, type ColumnaTabla } from '@/ui'
import type { Ingreso } from '../services/servicioAcceso'

const props = defineProps<{
  items: Ingreso[]
  total: number
  totalPaginas: number
  cargando: boolean
  nombreDeSede: (sedeId: number) => string
}>()

const pagina = defineModel<number>('pagina', { required: true })

const columnas: ColumnaTabla[] = [
  { clave: 'socio', etiqueta: 'Socio', encabezadoFila: true },
  { clave: 'dni', etiqueta: 'DNI' },
  { clave: 'sede', etiqueta: 'Sede' },
  { clave: 'ingreso', etiqueta: 'Fecha y Hora Ingreso' },
  { clave: 'egreso', etiqueta: 'Fecha y Hora Egreso' },
  { clave: 'estado', etiqueta: 'Estado actual' },
]

const claveFila = (fila: Ingreso) => fila.id

function formatearFechaHora(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="tabla-historial">
    <TablaFz
      titulo="Historial de accesos"
      ocultar-titulo
      :columnas="columnas"
      :filas="items"
      :clave-fila="claveFila"
      :ocupada="cargando"
      texto-vacio="No se encontraron registros de accesos con los filtros seleccionados."
    >
      <template #celda-socio="{ fila }">
        <div class="tabla-historial__socio">
          <strong>{{ (fila as Ingreso).nombre }}</strong>
          <span class="tabla-historial__id">ID: {{ (fila as Ingreso).socioId }}</span>
        </div>
      </template>

      <template #celda-dni="{ fila }">
        <span>{{ (fila as Ingreso).dni }}</span>
      </template>

      <template #celda-sede="{ fila }">
        <span>{{ nombreDeSede((fila as Ingreso).sedeId) }}</span>
      </template>

      <template #celda-ingreso="{ fila }">
        <span>{{ formatearFechaHora((fila as Ingreso).fechaHoraIngreso) }}</span>
      </template>

      <template #celda-egreso="{ fila }">
        <span>{{ formatearFechaHora((fila as Ingreso).fechaHoraEgreso) }}</span>
      </template>

      <template #celda-estado="{ fila }">
        <InsigniaFz v-if="!(fila as Ingreso).fechaHoraEgreso" variante="exito">
          En la sede
        </InsigniaFz>
        <InsigniaFz v-else variante="neutra">
          Egresado
        </InsigniaFz>
      </template>
    </TablaFz>

    <div v-if="totalPaginas > 1" class="tabla-historial__paginacion">
      <PaginacionFz
        v-model="pagina"
        :total-paginas="totalPaginas"
      />
    </div>
  </div>
</template>

<style scoped>
.tabla-historial {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espacio-4, 1rem);
  width: 100%;
}

.tabla-historial__socio {
  display: flex;
  flex-direction: column;
}

.tabla-historial__id {
  font-size: var(--fz-texto-xs, 0.75rem);
  color: var(--fz-color-texto-atenuado, #6b7280);
}

.tabla-historial__paginacion {
  display: flex;
  justify-content: center;
  padding: var(--fz-espacio-2, 0.5rem) 0;
}
</style>
