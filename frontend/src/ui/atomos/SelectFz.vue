<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    tamano?: 'sm' | 'md' | 'lg'
    invalido?: boolean
  }>(),
  {
    tamano: 'md',
    invalido: false,
  },
)

const modelo = defineModel<string>()
</script>

<template>
  <select
    v-bind="$attrs"
    v-model="modelo"
    :aria-invalid="invalido || undefined"
    :class="['select', `select--${tamano}`, { 'select--invalido': invalido }]"
  >
    <slot />
  </select>
</template>

<style scoped>
.select {
  display: block;
  width: 100%;
  border: var(--fz-select-borde-ancho) solid var(--fz-select-borde);
  border-radius: var(--fz-select-radio);
  background: var(--fz-select-fondo);
  color: var(--fz-select-texto);
  font-family: inherit;
  transition: border-color 0.15s;
}

/* Tamaños */
.select--sm {
  height: var(--fz-select-alto-sm);
  padding: 0 var(--fz-select-relleno-x-sm);
  font-size: var(--fz-select-texto-sm);
}

.select--md {
  height: var(--fz-select-alto-md);
  padding: 0 var(--fz-select-relleno-x-md);
  font-size: var(--fz-select-texto-md);
}

.select--lg {
  height: var(--fz-select-alto-lg);
  padding: 0 var(--fz-select-relleno-x-lg);
  font-size: var(--fz-select-texto-lg);
}

.select:hover:not(:disabled) {
  border-color: var(--fz-select-borde-hover);
}

/* Foco visible */
.select:focus-visible {
  border-color: var(--fz-select-borde-foco);
  outline: var(--fz-select-foco-ancho) solid var(--fz-select-foco-color);
  outline-offset: var(--fz-select-foco-separacion);
}

.select--invalido,
.select--invalido:hover:not(:disabled) {
  border-color: var(--fz-select-borde-invalido);
}

.select:disabled {
  background: var(--fz-select-deshabilitado-fondo);
  color: var(--fz-select-deshabilitado-texto);
  cursor: not-allowed;
}
</style>
