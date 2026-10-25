<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    variante?: 'primario' | 'secundario' | 'peligro' | 'advertencia' | 'fantasma'
    tamano?: 'sm' | 'md' | 'lg'
    cargando?: boolean
    tipo?: 'button' | 'submit' | 'reset'
    // 'a' lo dibuja como enlace (el `href` llega por atributos) con el aspecto de un botón.
    como?: 'button' | 'a'
  }>(),
  {
    variante: 'primario',
    tamano: 'md',
    cargando: false,
    tipo: 'button',
    como: 'button',
  },
)

const attrs = useAttrs()

// `disabled` llega por atributos (presente sin valor = ''), y `cargando` también bloquea el botón.
const deshabilitado = computed(
  () => props.cargando || (attrs.disabled !== undefined && attrs.disabled !== false),
)
</script>

<template>
  <component
    :is="como"
    v-bind="attrs"
    :type="como === 'button' ? tipo : undefined"
    :disabled="como === 'button' ? deshabilitado : undefined"
    :aria-busy="cargando || undefined"
    :class="['boton', `boton--${variante}`, `boton--${tamano}`, { 'boton--cargando': cargando }]"
  >
    <span v-if="cargando" class="boton__spinner" aria-hidden="true" />
    <slot />
  </component>
</template>

<style scoped>
.boton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--fz-boton-separacion);
  border: var(--fz-boton-borde-ancho) solid transparent;
  border-radius: var(--fz-boton-radio);
  font-family: inherit;
  font-weight: var(--fz-boton-peso);
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s;
}

/* Tamaños */
.boton--sm {
  min-height: var(--fz-boton-alto-sm);
  padding: 0 var(--fz-boton-relleno-x-sm);
  font-size: var(--fz-boton-texto-sm);
}

.boton--md {
  min-height: var(--fz-boton-alto-md);
  padding: 0 var(--fz-boton-relleno-x-md);
  font-size: var(--fz-boton-texto-md);
}

.boton--lg {
  min-height: var(--fz-boton-alto-lg);
  padding: 0 var(--fz-boton-relleno-x-lg);
  font-size: var(--fz-boton-texto-lg);
}

/* Variantes */
.boton--primario {
  background: var(--fz-boton-primario-fondo);
  border-color: var(--fz-boton-primario-borde);
  color: var(--fz-boton-primario-texto);
}

.boton--primario:hover:not(:disabled) {
  background: var(--fz-boton-primario-fondo-hover);
  border-color: var(--fz-boton-primario-borde-hover);
}

.boton--secundario {
  background: var(--fz-boton-secundario-fondo);
  border-color: var(--fz-boton-secundario-borde);
  color: var(--fz-boton-secundario-texto);
}

.boton--secundario:hover:not(:disabled) {
  background: var(--fz-boton-secundario-fondo-hover);
  border-color: var(--fz-boton-secundario-borde-hover);
}

.boton--peligro {
  background: var(--fz-boton-peligro-fondo);
  border-color: var(--fz-boton-peligro-borde);
  color: var(--fz-boton-peligro-texto);
}

.boton--peligro:hover:not(:disabled) {
  background: var(--fz-boton-peligro-fondo-hover);
  border-color: var(--fz-boton-peligro-borde-hover);
  color: var(--fz-boton-peligro-texto-hover);
}

.boton--advertencia {
  background: var(--fz-boton-advertencia-fondo);
  border-color: var(--fz-boton-advertencia-borde);
  color: var(--fz-boton-advertencia-texto);
}

.boton--advertencia:hover:not(:disabled) {
  background: var(--fz-boton-advertencia-fondo-hover);
  border-color: var(--fz-boton-advertencia-borde-hover);
}

.boton--fantasma {
  background: var(--fz-boton-fantasma-fondo);
  border-color: var(--fz-boton-fantasma-borde);
  color: var(--fz-boton-fantasma-texto);
}

.boton--fantasma:hover:not(:disabled) {
  background: var(--fz-boton-fantasma-fondo-hover);
  border-color: var(--fz-boton-fantasma-borde-hover);
}

/* Foco visible */
.boton:focus-visible {
  outline: var(--fz-boton-foco-ancho) solid var(--fz-boton-foco-color);
  outline-offset: var(--fz-boton-foco-separacion);
}

/* Deshabilitado (el cargando conserva su aspecto, solo deja de ser clickeable) */
.boton:disabled:not(.boton--cargando) {
  background: var(--fz-boton-deshabilitado-fondo);
  border-color: var(--fz-boton-deshabilitado-borde);
  color: var(--fz-boton-deshabilitado-texto);
  cursor: not-allowed;
}

.boton--cargando {
  cursor: progress;
}

.boton__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: var(--fz-radio-pildora);
  animation: boton-giro 0.7s linear infinite;
}

@keyframes boton-giro {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .boton__spinner {
    animation-duration: 2s;
  }
}
</style>
