<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { BotonFz, InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { ETIQUETA_ESTADO_CANCHA, ETIQUETA_TIPO_CANCHA, formatearMonto } from '../presentacion'
import type { Cancha } from '../services/servicioCanchas'

defineProps<{ canchas: Cancha[]; ocupada: boolean }>()

const COLUMNAS: ColumnaTabla[] = [
  { clave: 'tipo', etiqueta: 'Deporte' },
  { clave: 'estado', etiqueta: 'Estado' },
  { clave: 'costo', etiqueta: 'Precio base por hora' },
  { clave: 'acciones', etiqueta: 'Turnos' },
]
</script>

<template>
  <TablaFz
    titulo="Canchas de la sede"
    :columnas="COLUMNAS"
    :filas="canchas"
    :clave-fila="(cancha) => cancha.id"
    :ocupada="ocupada"
    ocultar-titulo
  >
    <template #celda-tipo="{ fila }">
      {{ ETIQUETA_TIPO_CANCHA[fila.tipo] }} <span class="lista-canchas__id">#{{ fila.id }}</span>
    </template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="fila.estado === 'OPERATIVA' ? 'exito' : 'advertencia'">
        {{ ETIQUETA_ESTADO_CANCHA[fila.estado] }}
      </InsigniaFz>
    </template>
    <template #celda-costo="{ fila }">{{ formatearMonto(fila.costoPorHora) }}</template>
    <template #celda-acciones="{ fila }">
      <RouterLink :to="{ name: 'cancha-turnos', params: { canchaId: fila.id } }">
        <BotonFz tamano="sm" variante="secundario">Ver turnos</BotonFz>
      </RouterLink>
    </template>
  </TablaFz>
</template>

<style scoped>
.lista-canchas__id {
  color: var(--fz-color-texto-suave);
  font-weight: 400;
}
</style>
