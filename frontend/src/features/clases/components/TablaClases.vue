<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { estadoDeClase, formatearHorario } from '../presentacion'
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
  { clave: 'cupos', etiqueta: 'Cupos libres', ajustada: true },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
]

const claveFila = (fila: Clase) => fila.id
</script>

<template>
  <TablaFz titulo="Agenda de clases" ocultar-titulo :columnas="columnas" :filas="clases" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-tipo="{ fila }">
      <RouterLink :to="{ name: 'clase-detalle', params: { claseId: fila.id } }" class="tabla-clases__enlace">
        {{ fila.tipo }}
      </RouterLink>
    </template>
    <template #celda-horario="{ fila }">{{ formatearHorario(fila) }}</template>
    <template #celda-sede="{ fila }">{{ nombreSede(fila.sedeId) }}</template>
    <template #celda-cupos="{ fila }">{{ fila.cupoDisponible }} de {{ fila.capacidad }}</template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="estadoDeClase(fila).variante">{{ estadoDeClase(fila).etiqueta }}</InsigniaFz>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-clases__enlace {
  color: var(--fz-color-texto);
  font-weight: var(--fz-peso-enfasis);
  text-decoration: none;
}

.tabla-clases__enlace:hover {
  text-decoration: underline;
}

.tabla-clases__enlace:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}
</style>
