<script setup lang="ts">
import { computed } from 'vue'
import { BotonFz, InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { reservanteDe } from '../composables/useReservantesDelDia'
import { rangoDeTurno } from '../presentacion'
import type { Disponibilidad } from '../services/servicioCanchas'
import type { Reservante } from '../tipos'
import type { EstadoTurno, TurnoClasificado } from '../turnos'

const props = defineProps<{
  turnos: TurnoClasificado[]
  // Quien reserva (SOCIO, EXTERNO) tiene una columna con "Reservar" en las filas libres; RECEPCION y GERENTE no tienen esa
  // columna.
  puedeReservar: boolean
  // Solo RECEPCION y GERENTE: suma la columna "Reservó", con quién tiene cada turno ocupado (instante de inicio → reservante).
  reservantes?: ReadonlyMap<number, Reservante>
}>()

const emit = defineEmits<{ elegir: [turno: Disponibilidad] }>()

// El estado siempre se dice con una palabra. "Ya pasó" va atenuado, sin insignia, y no tiene acción.
const ETIQUETA: Record<EstadoTurno, string> = { pasado: 'Ya pasó', libre: 'Libre', ocupado: 'Ocupado' }
const VARIANTE = { libre: 'exito', ocupado: 'advertencia' } as const

const columnas = computed<ColumnaTabla[]>(() => [
  { clave: 'horario', etiqueta: 'Horario', encabezadoFila: true },
  { clave: 'estado', etiqueta: 'Estado' },
  ...(props.reservantes ? [{ clave: 'reservo', etiqueta: 'Reservó' }] : []),
  ...(props.puedeReservar ? [{ clave: 'accion', etiqueta: 'Reserva', ajustada: true, alineacion: 'fin' as const }] : []),
])

const claveFila = (fila: TurnoClasificado) => fila.turno.fechaHoraInicio
const rango = (turno: Disponibilidad) => rangoDeTurno(turno.fechaHoraInicio, turno.fechaHoraFin)

// Un turno libre no tiene reservante; uno ocupado o ya empezado solo lo tiene si aparece entre las reservas vigentes del día.
const reservanteDelTurno = (fila: TurnoClasificado) =>
  fila.estado === 'libre' || !props.reservantes ? undefined : reservanteDe(props.reservantes, fila.turno.fechaHoraInicio)
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

    <template #celda-reservo="{ fila }">
      <template v-if="reservanteDelTurno(fila)">
        <template v-if="reservanteDelTurno(fila)?.nombre">
          {{ reservanteDelTurno(fila)?.nombre }}<span class="turnos__id"> #{{ reservanteDelTurno(fila)?.usuarioId }}</span>
        </template>
        <!-- Sin el nombre (todavía no llegó, o no se pudo pedir) se dice quién es por su id. -->
        <template v-else>Usuario #{{ reservanteDelTurno(fila)?.usuarioId }}</template>
      </template>
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

/* El id de quien reservó, con el estilo del "#id" de las canchas: gris suave y más chico. */
.turnos__id {
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
