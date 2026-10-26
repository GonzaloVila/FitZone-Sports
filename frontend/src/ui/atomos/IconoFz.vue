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
  | 'acciones'
  | 'exito'
  | 'error'
  | 'info'
  | 'ojo'
  | 'ojo-tachado'
  | 'buscar'
  | 'mas'
  | 'cambiar'
  | 'pausa'
  | 'reproducir'
  | 'quitar-usuario'
  | 'advertencia'
  | 'tilde'
  | 'flecha-izquierda'
  | 'lugar'
  | 'correo'
  | 'telefono'
  | 'identificador'
  | 'editar'
  | 'flecha-derecha'
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
  // Tres puntos en horizontal.
  acciones: ['M4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0', 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0', 'M18 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0'],
  // Círculo con tilde.
  exito: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M8 12.5l3 3 5-6'],
  // Círculo con signo de exclamación.
  error: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 7.5v5', 'M12 16v.01'],
  // Círculo con una "i".
  info: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 11v5', 'M12 8v.01'],
  // Ojo abierto: contorno con la pupila al centro.
  ojo: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0'],
  // El mismo ojo cruzado por una barra.
  'ojo-tachado': ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', 'M4 4l16 16'],
  // Lupa: lente y mango en diagonal.
  buscar: ['M4.5 11a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0', 'M16 16l4.5 4.5'],
  // Cruz de suma.
  mas: ['M12 5v14', 'M5 12h14'],
  // Dos flechas circulares, una hacia cada lado.
  cambiar: ['M4 12a8 8 0 0 1 13.5-5.8L20 8.5', 'M20 4v4.5h-4.5', 'M20 12a8 8 0 0 1-13.5 5.8L4 15.5', 'M4 20v-4.5h4.5'],
  // Dos barras verticales.
  pausa: ['M7 5h3.5v14H7z', 'M13.5 5H17v14h-3.5z'],
  // Triángulo apuntando a la derecha.
  reproducir: ['M7 4.5l12 7.5-12 7.5z'],
  // Una persona con un signo menos al costado.
  'quitar-usuario': [
    'M5 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
    'M2.5 20v-1a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v1',
    'M17.5 10h4.5',
  ],
  // Triángulo con signo de exclamación.
  advertencia: ['M10.3 4.3L2.9 17.4a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z', 'M12 9.5v4', 'M12 17v.01'],
  // Tilde simple, sin círculo.
  tilde: ['M5 12.5l4.5 4.5L19 7.5'],
  // Flecha hacia la izquierda: línea y punta.
  'flecha-izquierda': ['M19 12H5', 'M11 6l-6 6 6 6'],
  // Marcador de mapa: gota con un círculo al centro.
  lugar: ['M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z', 'M9.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0'],
  // Sobre: contorno y solapa.
  correo: ['M3 6h18v12H3z', 'M3 7l9 6.5L21 7'],
  // Auricular de teléfono.
  telefono: ['M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z'],
  // Numeral: dos barras verticales y dos horizontales.
  identificador: ['M9 4L7 20', 'M17 4l-2 16', 'M4.5 9h16', 'M3.5 15h16'],
  // Lápiz en diagonal, con la línea de la punta.
  editar: ['M4 20v-4l11-11a2.8 2.8 0 0 1 4 4L8 20z', 'M13.5 6.5l4 4'],
  // Flecha hacia la derecha: línea y punta.
  'flecha-derecha': ['M5 12h14', 'M13 6l6 6-6 6'],
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
