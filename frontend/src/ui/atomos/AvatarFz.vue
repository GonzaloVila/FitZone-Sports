<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    nombre: string
    tamano?: 'sm' | 'md' | 'lg'
  }>(),
  {
    tamano: 'md',
  },
)

// Es decorativo (aria-hidden en la plantilla): el nombre siempre va escrito al lado.
const NEUTRO = '?'

// Primera letra de las dos primeras palabras. Con una sola palabra, solo su primera letra.
// Se normaliza (NFC) para no perder el acento de un nombre con tilde descompuesta, y se parte por
// caracteres (no por unidades UTF-16) para no cortar a la mitad un carácter fuera del plano básico.
const iniciales = computed(() => {
  const palabras = props.nombre.normalize('NFC').split(/\s+/).filter(Boolean)
  const letras = palabras.slice(0, 2).map((palabra) => Array.from(palabra)[0])
  return letras.length ? letras.join('').toLocaleUpperCase('es') : NEUTRO
})
</script>

<template>
  <span :class="['avatar', `avatar--${tamano}`]" aria-hidden="true">{{ iniciales }}</span>
</template>

<style scoped>
.avatar {
  display: inline-grid;
  flex: none;
  place-items: center;
  border-radius: var(--fz-avatar-radio);
  background: var(--fz-avatar-fondo);
  color: var(--fz-avatar-texto);
  font-size: var(--fz-avatar-texto-tamano);
  font-weight: var(--fz-avatar-peso);
  line-height: 1;
  user-select: none;
}

.avatar--sm {
  width: var(--fz-avatar-tamano-sm);
  height: var(--fz-avatar-tamano-sm);
}

.avatar--md {
  width: var(--fz-avatar-tamano-md);
  height: var(--fz-avatar-tamano-md);
}

.avatar--lg {
  width: var(--fz-avatar-tamano-lg);
  height: var(--fz-avatar-tamano-lg);
  font-size: var(--fz-avatar-texto-tamano-lg);
}
</style>
