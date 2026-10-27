<script setup lang="ts">
import { computed } from 'vue'
import { estadoDeTurno } from '../presentacion'
import type { Disponibilidad, ReservaCancha } from '../services/servicioCanchas'
import { agruparPorFranja, resumenDeTurnos } from '../turnos'
import TurnoDeCancha from './TurnoDeCancha.vue'

const props = defineProps<{
  turnos: Disponibilidad[]
  mantenimiento: boolean
  reservas: ReservaCancha[]
  ahora: Date
  // Quien reserva (SOCIO, EXTERNO) elige un turno libre con un botón; el personal solo consulta.
  puedeReservar: boolean
  ocupada?: boolean
}>()

const emit = defineEmits<{ elegir: [turno: Disponibilidad] }>()

const grupos = computed(() =>
  agruparPorFranja(props.turnos, (turno) => estadoDeTurno(turno, props.mantenimiento, props.reservas, props.ahora)),
)
const resumen = computed(() => resumenDeTurnos(grupos.value.flatMap((grupo) => grupo.turnos)))
</script>

<template>
  <div class="turnos" :aria-busy="ocupada || undefined">
    <!-- Cuántos turnos hay libres y ocupados ese día; la región avisa el cambio al elegir otro día. -->
    <p class="turnos__resumen" role="status" aria-live="polite" aria-atomic="true">{{ resumen }}</p>

    <section v-for="grupo in grupos" :key="grupo.franja" class="turnos__franja" :aria-labelledby="`franja-${grupo.franja}`">
      <h2 :id="`franja-${grupo.franja}`" class="turnos__titulo">{{ grupo.etiqueta }}</h2>
      <ul class="turnos__lista">
        <TurnoDeCancha
          v-for="item in grupo.turnos"
          :key="item.turno.fechaHoraInicio"
          :item="item"
          :reservable="puedeReservar"
          @elegir="emit('elegir', item.turno)"
        />
      </ul>
    </section>
  </div>
</template>

<style scoped>
.turnos {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.turnos__resumen {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-cuerpo);
  font-weight: var(--fz-peso-enfasis);
}

.turnos__franja {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.turnos__titulo {
  margin: 0;
  color: var(--fz-color-texto);
  font-size: var(--fz-texto-subtitulo);
  font-weight: var(--fz-peso-enfasis);
}

.turnos__lista {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(8 * var(--fz-espaciado-amplio)), 1fr));
  gap: var(--fz-espaciado-compacto);
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
