<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { BotonFz, InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { ETIQUETA_ESTADO_CANCHA, ETIQUETA_TIPO_CANCHA, formatearMonto } from '../presentacion'
import type { Cancha } from '../services/servicioCanchas'

defineProps<{
  canchas: Cancha[]
  // Parámetros de dirección del enlace a la grilla de turnos (de dónde se vino y con qué filtros).
  parametrosDetalle?: Record<string, string>
  ocupada?: boolean
}>()

const columnas: ColumnaTabla[] = [
  { clave: 'tipo', etiqueta: 'Deporte', encabezadoFila: true },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
  { clave: 'costo', etiqueta: 'Precio base por hora', ajustada: true },
  { clave: 'acciones', etiqueta: 'Turnos', ajustada: true, alineacion: 'fin' },
]

const claveFila = (fila: Cancha) => fila.id
const nombreDe = (cancha: Cancha) => `${ETIQUETA_TIPO_CANCHA[cancha.tipo]} #${cancha.id}`
</script>

<template>
  <TablaFz titulo="Canchas de la sede" ocultar-titulo :columnas="columnas" :filas="canchas" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-tipo="{ fila }">
      <span class="lista-canchas__nombre">{{ ETIQUETA_TIPO_CANCHA[fila.tipo] }}</span>
      <span class="lista-canchas__id"> #{{ fila.id }}</span>
    </template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="fila.estado === 'OPERATIVA' ? 'exito' : 'advertencia'">
        {{ ETIQUETA_ESTADO_CANCHA[fila.estado] }}
      </InsigniaFz>
    </template>
    <template #celda-costo="{ fila }">{{ formatearMonto(fila.costoPorHora) }}</template>
    <template #celda-acciones="{ fila }">
      <RouterLink
        v-slot="{ href, navigate }"
        :to="{ name: 'cancha-turnos', params: { canchaId: fila.id }, query: parametrosDetalle }"
        custom
      >
        <BotonFz como="a" variante="secundario" tamano="sm" :href="href" :aria-label="`Ver turnos de ${nombreDe(fila)}`" @click="navigate">
          Ver turnos
        </BotonFz>
      </RouterLink>
    </template>
  </TablaFz>
</template>

<style scoped>
.lista-canchas__nombre {
  font-weight: var(--fz-peso-enfasis);
}

.lista-canchas__id {
  color: var(--fz-color-texto-suave);
}
</style>
