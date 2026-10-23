<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { formatearHorario } from '../presentacion'
import type { Clase } from '../services/servicioClases'

defineProps<{
  clases: Clase[]
  nombreSede: (sedeId: number) => string
  ocupada?: boolean
}>()

const columnas: ColumnaTabla[] = [
  { clave: 'tipo', etiqueta: 'Clase', encabezadoFila: true },
  { clave: 'horario', etiqueta: 'Horario' },
  { clave: 'instructor', etiqueta: 'Instructor' },
  { clave: 'sede', etiqueta: 'Sede' },
  { clave: 'cupos', etiqueta: 'Cupos libres' },
  { clave: 'estado', etiqueta: 'Estado' },
]

const claveFila = (fila: Clase) => fila.id

// El estado sale de los cupos que informa el servidor y del horario de inicio.
function estadoDe(clase: Clase): { etiqueta: string; variante: 'neutra' | 'exito' | 'peligro' } {
  if (new Date(clase.horarioInicio).getTime() <= Date.now()) return { etiqueta: 'Comenzada', variante: 'neutra' }
  if (clase.cupoDisponible <= 0) return { etiqueta: 'Sin cupos', variante: 'peligro' }
  return { etiqueta: 'Con cupos', variante: 'exito' }
}
</script>

<template>
  <TablaFz titulo="Agenda de clases" ocultar-titulo :columnas="columnas" :filas="clases" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-tipo="{ fila }">
      <RouterLink :to="{ name: 'clase-detalle', params: { claseId: (fila as Clase).id } }" class="tabla-clases__enlace">
        {{ (fila as Clase).tipo }}
      </RouterLink>
    </template>
    <template #celda-horario="{ fila }">{{ formatearHorario(fila as Clase) }}</template>
    <template #celda-sede="{ fila }">{{ nombreSede((fila as Clase).sedeId) }}</template>
    <template #celda-cupos="{ fila }">
      {{ (fila as Clase).cupoDisponible }} de {{ (fila as Clase).capacidad }}
    </template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="estadoDe(fila as Clase).variante">{{ estadoDe(fila as Clase).etiqueta }}</InsigniaFz>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-clases__enlace {
  color: var(--fz-color-primario);
  font-weight: var(--fz-peso-enfasis);
}

.tabla-clases__enlace:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}
</style>
