<script setup lang="ts">
import IconoFz from './IconoFz.vue'
import type { NombreIconoFz } from './IconoFz.vue'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    tipo?: 'text' | 'email' | 'password' | 'search' | 'number' | 'date' | 'time'
    tamano?: 'sm' | 'md' | 'lg'
    invalido?: boolean
    // Ícono decorativo a la izquierda, dentro del campo (ej. 'buscar'). El nombre accesible lo da una etiqueta o un aria-label.
    icono?: NombreIconoFz
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
  <span v-if="icono" class="campo-envoltorio">
    <IconoFz :nombre="icono" tamano="sm" class="campo-envoltorio__icono" />
    <input
      v-bind="$attrs"
      v-model="modelo"
      :type="tipo"
      :aria-invalid="invalido || undefined"
      :class="['campo', `campo--${tamano}`, 'campo--con-icono', { 'campo--invalido': invalido }]"
    />
  </span>
  <input
    v-else
    v-bind="$attrs"
    v-model="modelo"
    :type="tipo"
    :aria-invalid="invalido || undefined"
    :class="['campo', `campo--${tamano}`, { 'campo--invalido': invalido }]"
  />
</template>

<style scoped>
.campo-envoltorio {
  position: relative;
  display: block;
}

.campo-envoltorio__icono {
  position: absolute;
  top: 50%;
  left: var(--fz-campo-icono-posicion);
  transform: translateY(-50%);
  color: var(--fz-campo-icono-color);
  pointer-events: none;
}

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

/* Va después de los tamaños (misma especificidad): deja lugar al ícono. */
.campo--con-icono {
  padding-left: var(--fz-campo-icono-relleno);
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
