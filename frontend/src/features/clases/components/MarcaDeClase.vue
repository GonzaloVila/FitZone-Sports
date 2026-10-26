<script setup lang="ts">
import { computed } from 'vue'
import { IconoFz, InsigniaFz } from '@/ui'
import { PRESENTACION_MARCA, type MarcaClase } from '../marcasClases'

// Chip chico junto al nombre de una clase de la agenda: lo que el socio ya tiene en ella. Se lee por el texto; el tilde y el
// color solo lo refuerzan.
const props = defineProps<{
  marca: MarcaClase
}>()

const presentacion = computed(() => PRESENTACION_MARCA[props.marca])
</script>

<template>
  <InsigniaFz :variante="presentacion.variante" class="marca-clase">
    <IconoFz v-if="presentacion.conTilde" nombre="tilde" tamano="sm" />
    {{ presentacion.etiqueta }}
  </InsigniaFz>
</template>

<style scoped>
.marca-clase {
  gap: var(--fz-espaciado-compacto);
}
</style>
