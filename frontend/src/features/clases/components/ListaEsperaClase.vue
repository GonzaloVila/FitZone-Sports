<script setup lang="ts">
import { InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { ETIQUETAS_ESTADO_ESPERA, VARIANTES_ESTADO_ESPERA } from '../presentacion'
import type { EsperaClase } from '../services/servicioClases'

defineProps<{
  espera: EsperaClase[]
}>()

const columnas: ColumnaTabla[] = [
  { clave: 'orden', etiqueta: 'Orden', encabezadoFila: true },
  { clave: 'socio', etiqueta: 'Socio' },
  { clave: 'estado', etiqueta: 'Notificación' },
]

const claveFila = (fila: EsperaClase) => fila.id
</script>

<template>
  <p v-if="espera.length === 0" class="lista-vacia">No hay socios en lista de espera.</p>
  <TablaFz v-else titulo="Lista de espera" :columnas="columnas" :filas="espera" :clave-fila="claveFila">
    <!-- El orden es el de la cola que devuelve el servidor. -->
    <template #celda-orden="{ fila }">{{ espera.indexOf(fila as EsperaClase) + 1 }}</template>
    <template #celda-socio="{ fila }">Socio #{{ (fila as EsperaClase).socioId }}</template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="VARIANTES_ESTADO_ESPERA[(fila as EsperaClase).estado]">
        {{ ETIQUETAS_ESTADO_ESPERA[(fila as EsperaClase).estado] }}
      </InsigniaFz>
    </template>
  </TablaFz>
</template>

<style scoped>
.lista-vacia {
  margin: 0;
  color: var(--fz-color-texto-suave);
}
</style>
