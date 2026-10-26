<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import IconoFz from '../atomos/IconoFz.vue'

defineProps<{
  titulo: string
  subtitulo?: string
  // Enlace "← Volver a …" sobre el título: `a` es una ruta del router (nunca history.back()).
  volver?: { texto: string; a: RouteLocationRaw }
}>()

defineSlots<{
  // Junto al título (por ejemplo, una insignia con el conteo).
  insignia?: () => unknown
  // A la derecha del encabezado; en pantallas angostas pasa debajo del título.
  acciones?: () => unknown
}>()
</script>

<template>
  <header class="encabezado">
    <!-- RouterLink queda registrado globalmente por el router de la app: el kit no lo importa. -->
    <RouterLink v-if="volver" :to="volver.a" class="encabezado__volver">
      <IconoFz nombre="flecha-izquierda" tamano="sm" />
      {{ volver.texto }}
    </RouterLink>

    <div class="encabezado__fila">
      <div class="encabezado__titulos">
        <div class="encabezado__titulo-grupo">
          <h1 class="encabezado__titulo">{{ titulo }}</h1>
          <slot name="insignia" />
        </div>
        <p v-if="subtitulo" class="encabezado__subtitulo">{{ subtitulo }}</p>
      </div>

      <div v-if="$slots.acciones" class="encabezado__acciones"><slot name="acciones" /></div>
    </div>
  </header>
</template>

<style scoped>
.encabezado {
  display: flex;
  flex-direction: column;
  gap: var(--fz-encabezado-pagina-separacion);
}

.encabezado__volver {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: var(--fz-espaciado-compacto);
  min-height: var(--fz-encabezado-pagina-volver-alto);
  color: var(--fz-encabezado-pagina-volver-color);
  font-size: var(--fz-encabezado-pagina-volver-texto);
  text-decoration: none;
}

.encabezado__volver:hover {
  color: var(--fz-encabezado-pagina-volver-color-hover);
}

.encabezado__volver:focus-visible {
  outline: var(--fz-encabezado-pagina-foco-ancho) solid var(--fz-encabezado-pagina-foco-color);
  outline-offset: var(--fz-encabezado-pagina-foco-separacion);
}

.encabezado__fila {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-encabezado-pagina-separacion);
}

.encabezado__titulos {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.encabezado__titulo-grupo {
  display: flex;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.encabezado__titulo {
  margin: 0;
  color: var(--fz-encabezado-pagina-titulo-color);
  font-size: var(--fz-encabezado-pagina-titulo-texto);
  font-weight: var(--fz-encabezado-pagina-titulo-peso);
}

.encabezado__subtitulo {
  margin: 0;
  color: var(--fz-encabezado-pagina-subtitulo-color);
  font-size: var(--fz-encabezado-pagina-subtitulo-texto);
}

.encabezado__acciones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}
</style>
