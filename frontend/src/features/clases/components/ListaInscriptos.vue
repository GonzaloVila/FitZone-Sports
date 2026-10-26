<script setup lang="ts">
import { InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { ETIQUETAS_ESTADO_RESERVA, VARIANTES_ESTADO_RESERVA } from '../presentacion'
import type { ReservaClase } from '../services/servicioClases'

defineProps<{
  inscriptos: ReservaClase[]
}>()

const columnas: ColumnaTabla[] = [
  { clave: 'socio', etiqueta: 'Socio', encabezadoFila: true },
  { clave: 'reserva', etiqueta: 'Reserva', ajustada: true },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
]

const claveFila = (fila: ReservaClase) => fila.id
</script>

<template>
  <p v-if="inscriptos.length === 0" class="lista-vacia">Todavía no hay socios inscriptos en esta clase.</p>
  <TablaFz v-else titulo="Socios inscriptos" ocultar-titulo :columnas="columnas" :filas="inscriptos" :clave-fila="claveFila">
    <template #celda-socio="{ fila }">Socio #{{ fila.socioId }}</template>
    <template #celda-reserva="{ fila }">#{{ fila.id }}</template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="VARIANTES_ESTADO_RESERVA[fila.estado]">{{ ETIQUETAS_ESTADO_RESERVA[fila.estado] }}</InsigniaFz>
    </template>
  </TablaFz>
</template>

<style scoped>
.lista-vacia {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
