<script setup lang="ts">
import { InsigniaFz } from '@/ui'
import type { Clase } from '../services/servicioClases'
import FilaDatoClase from './FilaDatoClase.vue'

defineProps<{
  clase: Clase
  nombreSede: string
}>()
</script>

<template>
  <dl class="datos">
    <FilaDatoClase etiqueta="Instructor" icono="socios">{{ clase.instructor }}</FilaDatoClase>
    <FilaDatoClase etiqueta="Sede" icono="lugar">{{ nombreSede }}</FilaDatoClase>
    <FilaDatoClase etiqueta="Cupos" icono="clases">
      <template v-if="clase.cupoDisponible > 0">{{ clase.cupoDisponible }} libres de {{ clase.capacidad }}</template>
      <InsigniaFz v-else variante="peligro">Sin cupos</InsigniaFz>
    </FilaDatoClase>
    <FilaDatoClase etiqueta="Reservas confirmadas" icono="tilde">{{ clase.reservasConfirmadas }}</FilaDatoClase>
  </dl>
</template>

<style scoped>
.datos {
  margin: 0;
  padding: 0 var(--fz-espaciado-base);
  border: 1px solid var(--fz-color-borde-marcado);
  border-radius: var(--fz-radio-control);
  background: var(--fz-color-fondo);
}

/* La primera fila no lleva línea arriba: ya la tiene el borde de la caja. */
.datos > :first-child {
  border-top: none;
}
</style>
