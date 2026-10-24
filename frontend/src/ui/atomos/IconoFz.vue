<script lang="ts">
export type NombreIconoFz =
  | 'carnet'
  | 'socios'
  | 'acceso'
  | 'clases'
  | 'canchas'
  | 'pagos'
  | 'reportes'
  | 'cerrar-sesion'
  | 'menu'
  | 'cerrar'
</script>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    nombre: NombreIconoFz
    tamano?: 'sm' | 'md' | 'lg'
  }>(),
  {
    tamano: 'md',
  },
)

// Trazos propios sobre una grilla de 24x24: cada ícono es una lista de `d` de <path> (sin relleno).
// Record<NombreIconoFz, ...> obliga a dibujar un ícono por cada nombre de la unión.
const TRAZOS: Record<NombreIconoFz, readonly string[]> = {
  // Tres marcas de esquina y unos módulos sueltos: un código QR.
  carnet: [
    'M4 4h6v6H4z',
    'M14 4h6v6h-6z',
    'M4 14h6v6H4z',
    'M14 14h3v3h-3z',
    'M20 14v.01',
    'M14 20v.01',
    'M17 20h3v-3',
  ],
  // Dos personas: la de adelante completa y la de atrás asomando.
  socios: [
    'M3 9a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
    'M2.5 20v-1a4.5 4.5 0 0 1 4.5-4.5h0a4.5 4.5 0 0 1 4.5 4.5v1',
    'M15 5.2a3 3 0 0 1 0 5.6',
    'M16.5 14.6a4.5 4.5 0 0 1 4.5 4.4v1',
  ],
  // Marco de una puerta con el picaporte y el piso.
  acceso: ['M6 21V4h12v17', 'M3 21h18', 'M14.5 12v.01'],
  // Calendario: tapa, dos anillas y el cuerpo.
  clases: ['M4 6h16v15H4z', 'M4 11h16', 'M8 3v4', 'M16 3v4'],
  // Un círculo con un punto al centro.
  canchas: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 12v.01'],
  // Hoja con la esquina doblada y dos renglones.
  pagos: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 13h6', 'M9 17h6'],
  // Tres barras de distinta altura sobre una base.
  reportes: ['M4 21h16', 'M6 21v-7h3v7', 'M10.5 21V5h3v16', 'M15 21v-10h3v10'],
  // Puerta abierta y flecha hacia afuera.
  'cerrar-sesion': ['M10 4H5v16h5', 'M10 12h10', 'M16 8l4 4-4 4'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  cerrar: ['M6 6l12 12', 'M18 6L6 18'],
}

const trazos = computed(() => TRAZOS[props.nombre])
</script>

<template>
  <svg
    :class="['icono', `icono--${tamano}`]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="trazo in trazos" :key="trazo" :d="trazo" />
  </svg>
</template>

<style scoped>
.icono {
  flex: none;
  stroke-width: var(--fz-icono-trazo);
}

.icono--sm {
  width: var(--fz-icono-tamano-sm);
  height: var(--fz-icono-tamano-sm);
}

.icono--md {
  width: var(--fz-icono-tamano-md);
  height: var(--fz-icono-tamano-md);
}

.icono--lg {
  width: var(--fz-icono-tamano-lg);
  height: var(--fz-icono-tamano-lg);
}
</style>
