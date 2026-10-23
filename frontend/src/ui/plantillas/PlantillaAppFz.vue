<script setup lang="ts">
import { useTemplateRef } from 'vue'

withDefaults(
  defineProps<{
    etiquetaNavegacion?: string
    textoSaltar?: string
  }>(),
  {
    etiquetaNavegacion: 'Navegación principal',
    textoSaltar: 'Saltar al contenido',
  },
)

const contenido = useTemplateRef<HTMLElement>('contenido')

// El enlace de salto mueve el foco al contenido sin tocar la URL (no pasa por el router).
function irAlContenido() {
  contenido.value?.focus()
}
</script>

<template>
  <div class="armazon">
    <a class="armazon__saltar" href="#contenido-principal" @click.prevent="irAlContenido">{{ textoSaltar }}</a>
    <header class="armazon__encabezado">
      <div class="armazon__marca"><slot name="encabezado" /></div>
      <nav v-if="$slots.navegacion" class="armazon__navegacion" :aria-label="etiquetaNavegacion">
        <slot name="navegacion" />
      </nav>
      <div v-if="$slots.acciones" class="armazon__acciones"><slot name="acciones" /></div>
    </header>
    <main id="contenido-principal" ref="contenido" class="armazon__contenido" tabindex="-1">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.armazon {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--fz-armazon-fondo);
}

/* Visible solo al recibir foco con el teclado. */
.armazon__saltar {
  position: absolute;
  top: 0;
  left: 0;
  padding: var(--fz-armazon-saltar-relleno) var(--fz-armazon-relleno-x);
  background: var(--fz-armazon-saltar-fondo);
  color: var(--fz-armazon-saltar-texto);
  transform: translateY(-100%);
}

.armazon__saltar:focus-visible {
  transform: translateY(0);
  outline: var(--fz-armazon-foco-ancho) solid var(--fz-armazon-foco-color);
  outline-offset: var(--fz-armazon-foco-separacion);
}

.armazon__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-armazon-relleno-y) var(--fz-armazon-separacion);
  padding: var(--fz-armazon-relleno-y) var(--fz-armazon-relleno-x);
  border-bottom: var(--fz-armazon-borde-ancho) solid var(--fz-armazon-encabezado-borde);
  background: var(--fz-armazon-encabezado-fondo);
}

.armazon__marca {
  order: 1;
  font-size: var(--fz-armazon-marca-texto);
  font-weight: var(--fz-armazon-marca-peso);
  color: var(--fz-armazon-marca-color);
}

.armazon__acciones {
  order: 2;
  margin-left: auto;
}

/* En ancho chico la navegación pasa a su propia fila y sus enlaces envuelven. */
.armazon__navegacion {
  order: 3;
  flex: 1 1 100%;
}

@media (min-width: 40rem) {
  .armazon__navegacion {
    order: 2;
    flex: 1 1 auto;
  }

  .armazon__acciones {
    order: 3;
  }
}

.armazon__contenido {
  width: 100%;
  max-width: var(--fz-armazon-contenido-ancho-max);
  margin: 0 auto;
  padding: var(--fz-armazon-contenido-relleno) var(--fz-armazon-relleno-x);
}

/* Recibe el foco por código desde el enlace de salto: no necesita anillo. */
.armazon__contenido:focus {
  outline: none;
}
</style>
