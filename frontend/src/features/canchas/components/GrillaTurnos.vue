<script setup lang="ts">
import { estadoDeTurno, rangoDeTurno, type EstadoTurno } from '../presentacion'
import type { Disponibilidad, ReservaCancha } from '../services/servicioCanchas'

const props = defineProps<{
  turnos: Disponibilidad[]
  mantenimiento: boolean
  reservas: ReservaCancha[]
  ahora: Date
}>()
const emit = defineEmits<{ elegir: [turno: Disponibilidad] }>()

const TEXTO: Record<EstadoTurno, string> = {
  libre: 'libre',
  ocupado: 'ocupado',
  mantenimiento: 'no disponible por mantenimiento',
  pasado: 'ya pasó',
}

function estado(turno: Disponibilidad): EstadoTurno {
  return estadoDeTurno(turno, props.mantenimiento, props.reservas, props.ahora)
}
</script>

<template>
  <ul class="grilla">
    <li v-for="turno in turnos" :key="turno.fechaHoraInicio">
      <button
        type="button"
        :class="['grilla__turno', { 'grilla__turno--bloqueado': estado(turno) !== 'libre' }]"
        :disabled="estado(turno) !== 'libre'"
        @click="emit('elegir', turno)"
      >
        <span class="grilla__rango">{{ rangoDeTurno(turno.fechaHoraInicio, turno.fechaHoraFin) }}</span>
        <span class="grilla__estado">{{ TEXTO[estado(turno)] }}</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.grilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: var(--fz-espaciado-compacto);
  margin: 0;
  padding: 0;
  list-style: none;
}

.grilla__turno {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
  padding: var(--fz-espaciado-compacto);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-control);
  background: var(--fz-color-superficie);
  color: var(--fz-color-texto);
  font-family: inherit;
  font-size: var(--fz-texto-cuerpo);
  text-align: left;
  cursor: pointer;
}

.grilla__turno:hover:not(:disabled) {
  background: var(--fz-color-hover);
}

.grilla__turno:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}

.grilla__turno--bloqueado {
  color: var(--fz-color-texto-suave);
  cursor: not-allowed;
  opacity: 0.75;
}

.grilla__rango {
  font-weight: 600;
}

.grilla__estado {
  font-size: var(--fz-texto-pequeno);
  text-transform: lowercase;
}
</style>
