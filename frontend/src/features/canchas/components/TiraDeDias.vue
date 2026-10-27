<script setup lang="ts">
import { BotonFz } from '@/ui'
import type { DiaDeLaTira } from '../turnos'

defineProps<{
  dias: DiaDeLaTira[]
}>()

// La fecha elegida (YYYY-MM-DD).
const fecha = defineModel<string>({ required: true })

// "Hoy" y "Mañana" no dicen la fecha: el lector de pantalla las lee completas.
function nombreAccesible(dia: DiaDeLaTira): string {
  return dia.etiqueta === 'Hoy' || dia.etiqueta === 'Mañana' ? `${dia.etiqueta}, ${dia.nombreCompleto}` : dia.nombreCompleto
}
</script>

<template>
  <div class="tira" role="group" aria-label="Día de los turnos">
    <BotonFz
      v-for="dia in dias"
      :key="dia.fecha"
      tamano="sm"
      :variante="dia.fecha === fecha ? 'primario' : 'secundario'"
      :aria-pressed="dia.fecha === fecha"
      :aria-label="nombreAccesible(dia)"
      @click="fecha = dia.fecha"
    >
      {{ dia.etiqueta }}
    </BotonFz>
  </div>
</template>

<style scoped>
.tira {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fz-espaciado-compacto);
}
</style>
