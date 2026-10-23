<script setup lang="ts">
withDefaults(
  defineProps<{
    variante?: 'neutra' | 'exito' | 'peligro' | 'advertencia'
  }>(),
  {
    variante: 'neutra',
  },
)
</script>

<template>
  <span :class="['insignia', `insignia--${variante}`]">
    <slot />
  </span>
</template>

<style scoped>
.insignia {
  display: inline-flex;
  align-items: center;
  padding: var(--fz-insignia-relleno-y) var(--fz-insignia-relleno-x);
  border: var(--fz-insignia-borde-ancho) solid transparent;
  border-radius: var(--fz-insignia-radio);
  font-size: var(--fz-insignia-texto);
  font-weight: var(--fz-insignia-peso);
  line-height: 1.25;
  white-space: nowrap;
}

.insignia--neutra {
  background: var(--fz-insignia-neutra-fondo);
  border-color: var(--fz-insignia-neutra-borde);
  color: var(--fz-insignia-neutra-texto);
}

.insignia--exito {
  background: var(--fz-insignia-exito-fondo);
  border-color: var(--fz-insignia-exito-borde);
  color: var(--fz-insignia-exito-texto);
}

.insignia--peligro {
  background: var(--fz-insignia-peligro-fondo);
  border-color: var(--fz-insignia-peligro-borde);
  color: var(--fz-insignia-peligro-texto);
}

.insignia--advertencia {
  background: var(--fz-insignia-advertencia-fondo);
  border-color: var(--fz-insignia-advertencia-borde);
  color: var(--fz-insignia-advertencia-texto);
}
</style>
