<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { BotonFz, InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { ETIQUETAS_ESTADO_RESERVA, VARIANTES_ESTADO_RESERVA, formatearHorario } from '../presentacion'
import { momentoDeClase } from '../reglas'
import type { FilaReserva } from '../tipos'

const props = defineProps<{
  titulo: string
  filas: FilaReserva[]
  nombreSede: (sedeId: number) => string
  ahora: number
  // Muestra la columna con el botón de cancelar (solo en las próximas).
  conAcciones?: boolean
  ocupada?: boolean
}>()

defineEmits<{
  (e: 'cancelar', fila: FilaReserva): void
}>()

const columnas: ColumnaTabla[] = [
  { clave: 'clase', etiqueta: 'Clase', encabezadoFila: true },
  { clave: 'horario', etiqueta: 'Horario' },
  { clave: 'sede', etiqueta: 'Sede' },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
  ...(props.conAcciones ? [{ clave: 'acciones', etiqueta: 'Acciones', ajustada: true, alineacion: 'fin' as const }] : []),
]

const claveFila = (fila: FilaReserva) => fila.reserva.id

function puedeCancelar(fila: FilaReserva): boolean {
  return fila.clase !== null && momentoDeClase(fila.clase, props.ahora) !== 'comenzada'
}
</script>

<template>
  <TablaFz :titulo="titulo" ocultar-titulo :columnas="columnas" :filas="filas" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-clase="{ fila }">
      <RouterLink :to="{ name: 'clase-detalle', params: { claseId: fila.reserva.claseId } }" class="tabla-reservas__enlace">
        {{ fila.clase?.tipo ?? `Clase #${fila.reserva.claseId}` }}
      </RouterLink>
    </template>
    <template #celda-horario="{ fila }">
      <template v-if="fila.clase">{{ formatearHorario(fila.clase) }}</template>
      <span v-else class="tabla-reservas__tenue">No disponible</span>
    </template>
    <template #celda-sede="{ fila }">
      <template v-if="fila.clase">{{ nombreSede(fila.clase.sedeId) }}</template>
      <span v-else class="tabla-reservas__tenue">—</span>
    </template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="VARIANTES_ESTADO_RESERVA[fila.reserva.estado]">
        {{ ETIQUETAS_ESTADO_RESERVA[fila.reserva.estado] }}
      </InsigniaFz>
    </template>
    <template #celda-acciones="{ fila }">
      <BotonFz v-if="puedeCancelar(fila)" variante="peligro" tamano="sm" @click="$emit('cancelar', fila)">Cancelar</BotonFz>
      <span v-else class="tabla-reservas__tenue">—</span>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-reservas__enlace {
  color: var(--fz-color-texto);
  font-weight: var(--fz-peso-enfasis);
  text-decoration: none;
}

.tabla-reservas__enlace:hover {
  text-decoration: underline;
}

.tabla-reservas__enlace:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}

.tabla-reservas__tenue {
  color: var(--fz-color-texto-suave);
}
</style>
