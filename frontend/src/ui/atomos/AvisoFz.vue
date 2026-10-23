<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variante?: 'peligro' | 'exito' | 'advertencia'
  }>(),
  {
    variante: 'peligro',
  },
)

// Éxito es informativo (no interrumpe); peligro y advertencia se anuncian de inmediato.
const rol = computed(() => (props.variante === 'exito' ? 'status' : 'alert'))
</script>

<template>
  <div :class="['aviso', `aviso--${variante}`]" :role="rol">
    <slot />
  </div>
</template>

<style scoped>
.aviso {
  padding: var(--fz-aviso-relleno-y) var(--fz-aviso-relleno-x);
  border: var(--fz-aviso-borde-ancho) solid transparent;
  border-radius: var(--fz-aviso-radio);
  font-size: var(--fz-aviso-texto);
}

.aviso--peligro {
  background: var(--fz-aviso-peligro-fondo);
  border-color: var(--fz-aviso-peligro-borde);
  color: var(--fz-aviso-peligro-texto);
}

.aviso--exito {
  background: var(--fz-aviso-exito-fondo);
  border-color: var(--fz-aviso-exito-borde);
  color: var(--fz-aviso-exito-texto);
}

.aviso--advertencia {
  background: var(--fz-aviso-advertencia-fondo);
  border-color: var(--fz-aviso-advertencia-borde);
  color: var(--fz-aviso-advertencia-texto);
}
</style>
