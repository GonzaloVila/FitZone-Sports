<script setup lang="ts">
import { computed } from 'vue'
import { BotonFz, InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { estadoDeTurno, rangoDeTurno, type EstadoTurno } from '../presentacion'
import type { Disponibilidad, ReservaCancha } from '../services/servicioCanchas'

const props = defineProps<{
  turnos: Disponibilidad[]
  mantenimiento: boolean
  reservas: ReservaCancha[]
  ahora: Date
  // Quien reserva ve el botón "Reservar" en los turnos libres; el personal solo consulta.
  puedeReservar: boolean
  ocupada?: boolean
}>()

const emit = defineEmits<{ elegir: [turno: Disponibilidad] }>()

// Cada turno dice su estado con una palabra (no solo con el color de la insignia).
const ETIQUETA: Record<EstadoTurno, string> = {
  libre: 'Libre',
  ocupado: 'Ocupado',
  mantenimiento: 'En mantenimiento',
  pasado: 'Ya pasó',
}

const VARIANTE: Record<EstadoTurno, 'exito' | 'peligro' | 'advertencia' | 'neutra'> = {
  libre: 'exito',
  ocupado: 'peligro',
  mantenimiento: 'advertencia',
  pasado: 'neutra',
}

const columnas = computed<ColumnaTabla[]>(() => [
  { clave: 'horario', etiqueta: 'Horario', encabezadoFila: true },
  { clave: 'estado', etiqueta: 'Estado' },
  ...(props.puedeReservar ? [{ clave: 'acciones', etiqueta: 'Reserva', ajustada: true, alineacion: 'fin' as const }] : []),
])

const claveFila = (fila: Disponibilidad) => fila.fechaHoraInicio
const rango = (turno: Disponibilidad) => rangoDeTurno(turno.fechaHoraInicio, turno.fechaHoraFin)
const estado = (turno: Disponibilidad) => estadoDeTurno(turno, props.mantenimiento, props.reservas, props.ahora)
</script>

<template>
  <TablaFz titulo="Turnos del día" ocultar-titulo :columnas="columnas" :filas="turnos" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-horario="{ fila }">
      <span :class="{ 'grilla__horario--apagado': estado(fila) !== 'libre' }">{{ rango(fila) }}</span>
    </template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="VARIANTE[estado(fila)]">{{ ETIQUETA[estado(fila)] }}</InsigniaFz>
    </template>
    <template #celda-acciones="{ fila }">
      <BotonFz v-if="estado(fila) === 'libre'" tamano="sm" :aria-label="`Reservar el turno de ${rango(fila)}`" @click="emit('elegir', fila)">
        Reservar
      </BotonFz>
      <span v-else class="grilla__sin-accion">—</span>
    </template>
  </TablaFz>
</template>

<style scoped>
.grilla__horario--apagado,
.grilla__sin-accion {
  color: var(--fz-color-texto-suave);
}
</style>
