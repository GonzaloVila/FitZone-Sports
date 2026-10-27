<script setup lang="ts">
import { computed } from 'vue'
import { BotonFz, InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { rangoDeTurno } from '../presentacion'
import type { Disponibilidad } from '../services/servicioCanchas'
import type { EstadoTurno, TurnoClasificado } from '../turnos'

const props = defineProps<{
  turnos: TurnoClasificado[]
  // Quien reserva (SOCIO, EXTERNO) tiene una columna con "Reservar" en las filas libres; RECEPCION y GERENTE no tienen esa
  // columna.
  puedeReservar: boolean
}>()

const emit = defineEmits<{ elegir: [turno: Disponibilidad] }>()

// El estado siempre se dice con una palabra. "Ya pasó" va atenuado, sin insignia, y no tiene acción.
const ETIQUETA: Record<EstadoTurno, string> = { pasado: 'Ya pasó', libre: 'Libre', ocupado: 'Ocupado' }
const VARIANTE = { libre: 'exito', ocupado: 'advertencia' } as const

const columnas = computed<ColumnaTabla[]>(() => [
  { clave: 'horario', etiqueta: 'Horario', encabezadoFila: true },
  { clave: 'estado', etiqueta: 'Estado' },
  ...(props.puedeReservar ? [{ clave: 'accion', etiqueta: 'Reserva', ajustada: true, alineacion: 'fin' as const }] : []),
])

const claveFila = (fila: TurnoClasificado) => fila.turno.fechaHoraInicio
const rango = (turno: Disponibilidad) => rangoDeTurno(turno.fechaHoraInicio, turno.fechaHoraFin)
</script>

<template>
  <TablaFz titulo="Turnos del día" ocultar-titulo :columnas="columnas" :filas="turnos" :clave-fila="claveFila">
    <template #celda-horario="{ fila }">
      <span :class="{ 'turnos__tenue': fila.estado === 'pasado' }">{{ rango(fila.turno) }}</span>
    </template>

    <template #celda-estado="{ fila }">
      <span v-if="fila.estado === 'pasado'" class="turnos__tenue">{{ ETIQUETA.pasado }}</span>
      <InsigniaFz v-else :variante="VARIANTE[fila.estado]">{{ ETIQUETA[fila.estado] }}</InsigniaFz>
    </template>

    <template #celda-accion="{ fila }">
      <BotonFz
        v-if="fila.estado === 'libre'"
        tamano="sm"
        :aria-label="`Reservar ${rango(fila.turno)}`"
        @click="emit('elegir', fila.turno)"
      >
        Reservar
      </BotonFz>
    </template>
  </TablaFz>
</template>

<style scoped>
.turnos__tenue {
  color: var(--fz-color-texto-suave);
}
</style>
