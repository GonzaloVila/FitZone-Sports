<script setup lang="ts">
const props = defineProps<{
  // Estado actual. El componente no lo cambia por su cuenta: avisa y el padre decide (después de guardar, por ejemplo).
  modelValue: boolean
  // Nombre accesible: el interruptor no tiene texto visible.
  etiqueta: string
  deshabilitado?: boolean
  // Hay una operación en curso: ignora clics y teclado.
  ocupado?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [valor: boolean]
}>()

// Es un <button> nativo: Espacio y Enter lo activan (generan un clic) sin código de teclado propio.
function alternar() {
  if (props.deshabilitado || props.ocupado) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :class="['interruptor', { 'interruptor--encendido': modelValue, 'interruptor--ocupado': ocupado }]"
    :aria-checked="modelValue"
    :aria-label="etiqueta"
    :aria-busy="ocupado || undefined"
    :disabled="deshabilitado"
    @click="alternar"
  >
    <span class="interruptor__pista" aria-hidden="true">
      <span class="interruptor__perilla" />
    </span>
  </button>
</template>

<style scoped>
.interruptor {
  display: inline-flex;
  flex: none;
  align-items: center;
  width: var(--fz-interruptor-ancho);
  height: var(--fz-interruptor-area-alto);
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.interruptor__pista {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: var(--fz-interruptor-ancho);
  height: var(--fz-interruptor-alto);
  padding: var(--fz-interruptor-perilla-margen);
  border-radius: var(--fz-radio-pildora);
  background: var(--fz-interruptor-apagado-fondo);
  transition: background-color var(--fz-interruptor-transicion);
}

.interruptor__perilla {
  width: var(--fz-interruptor-perilla-tamano);
  height: var(--fz-interruptor-perilla-tamano);
  border-radius: var(--fz-radio-pildora);
  background: var(--fz-interruptor-perilla-color);
  transition: transform var(--fz-interruptor-transicion);
}

.interruptor:hover:not(:disabled) .interruptor__pista {
  background: var(--fz-interruptor-apagado-fondo-hover);
}

.interruptor--encendido .interruptor__pista {
  background: var(--fz-interruptor-encendido-fondo);
}

.interruptor--encendido:hover:not(:disabled) .interruptor__pista {
  background: var(--fz-interruptor-encendido-fondo-hover);
}

.interruptor--encendido .interruptor__perilla {
  transform: translateX(var(--fz-interruptor-perilla-desplazamiento));
}

/* Foco visible (WCAG 1.4.11): el anillo rodea la pista. */
.interruptor:focus-visible {
  outline: none;
}

.interruptor:focus-visible .interruptor__pista {
  outline: var(--fz-interruptor-foco-ancho) solid var(--fz-interruptor-foco-color);
  outline-offset: var(--fz-interruptor-foco-separacion);
}

.interruptor--ocupado {
  opacity: var(--fz-interruptor-ocupado-opacidad);
  cursor: progress;
}

.interruptor:disabled {
  opacity: var(--fz-interruptor-deshabilitado-opacidad);
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .interruptor__pista,
  .interruptor__perilla {
    transition: none;
  }
}
</style>
