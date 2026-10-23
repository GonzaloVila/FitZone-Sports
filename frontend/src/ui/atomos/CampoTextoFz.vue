<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    tipo?: 'text' | 'email' | 'password' | 'search' | 'number' | 'date'
    tamano?: 'sm' | 'md' | 'lg'
    invalido?: boolean
  }>(),
  {
    tipo: 'text',
    tamano: 'md',
    invalido: false,
  },
)

const modelo = defineModel<string>()
</script>

<template>
  <input
    v-bind="$attrs"
    v-model="modelo"
    :type="tipo"
    :aria-invalid="invalido || undefined"
    :class="['campo', `campo--${tamano}`, { 'campo--invalido': invalido }]"
  />
</template>

<style scoped>
.campo {
  display: block;
  width: 100%;
  border: var(--fz-campo-borde-ancho) solid var(--fz-campo-borde);
  border-radius: var(--fz-campo-radio);
  background: var(--fz-campo-fondo);
  color: var(--fz-campo-texto);
  font-family: inherit;
  transition: border-color 0.15s;
}

/* Tamaños */
.campo--sm {
  height: var(--fz-campo-alto-sm);
  padding: 0 var(--fz-campo-relleno-x-sm);
  font-size: var(--fz-campo-texto-sm);
}

.campo--md {
  height: var(--fz-campo-alto-md);
  padding: 0 var(--fz-campo-relleno-x-md);
  font-size: var(--fz-campo-texto-md);
}

.campo--lg {
  height: var(--fz-campo-alto-lg);
  padding: 0 var(--fz-campo-relleno-x-lg);
  font-size: var(--fz-campo-texto-lg);
}

.campo::placeholder {
  color: var(--fz-campo-placeholder);
}

.campo:hover:not(:disabled) {
  border-color: var(--fz-campo-borde-hover);
}

/* Foco visible */
.campo:focus-visible {
  border-color: var(--fz-campo-borde-foco);
  outline: var(--fz-campo-foco-ancho) solid var(--fz-campo-foco-color);
  outline-offset: var(--fz-campo-foco-separacion);
}

.campo--invalido,
.campo--invalido:hover:not(:disabled) {
  border-color: var(--fz-campo-borde-invalido);
}

.campo:disabled {
  background: var(--fz-campo-deshabilitado-fondo);
  color: var(--fz-campo-deshabilitado-texto);
  cursor: not-allowed;
}
</style>
