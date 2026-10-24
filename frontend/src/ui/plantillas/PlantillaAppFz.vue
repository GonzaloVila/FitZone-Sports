<script setup lang="ts">
import { ref, useId, useTemplateRef } from 'vue'
import IconoFz from '../atomos/IconoFz.vue'

withDefaults(
  defineProps<{
    etiquetaNavegacion?: string
    textoSaltar?: string
    disposicion?: 'barra-superior' | 'barra-lateral'
    textoMenu?: string
    etiquetaAbrirMenu?: string
    etiquetaCerrarMenu?: string
  }>(),
  {
    etiquetaNavegacion: 'Navegación principal',
    textoSaltar: 'Saltar al contenido',
    disposicion: 'barra-superior',
    textoMenu: 'Menú',
    etiquetaAbrirMenu: 'Abrir menú',
    etiquetaCerrarMenu: 'Cerrar menú',
  },
)

const contenido = useTemplateRef<HTMLElement>('contenido')
const botonMenu = useTemplateRef<HTMLButtonElement>('botonMenu')

// El enlace de salto mueve el foco al contenido sin tocar la URL (no pasa por el router).
function irAlContenido() {
  contenido.value?.focus()
}

// Solo aplica a 'barra-lateral' en ancho chico: ahí el panel de links es un desplegable.
// No es un modal: no atrapa el foco, se cierra con Escape y al activar un enlace.
const idPanel = useId()
const menuAbierto = ref(false)

function alternarMenu() {
  menuAbierto.value = !menuAbierto.value
}

function alPresionarEscape() {
  if (!menuAbierto.value) return
  menuAbierto.value = false
  botonMenu.value?.focus()
}

// La plantilla no conoce el router: cualquier clic en un enlace del panel cuenta como navegar.
function alHacerClicEnPanel(evento: MouseEvent) {
  if (evento.target instanceof Element && evento.target.closest('a[href]')) menuAbierto.value = false
}
</script>

<template>
  <div :class="['armazon', `armazon--${disposicion}`]">
    <a class="armazon__saltar" href="#contenido-principal" @click.prevent="irAlContenido">{{ textoSaltar }}</a>

    <header v-if="disposicion === 'barra-lateral'" class="armazon__lateral" @keydown.esc="alPresionarEscape">
      <div class="armazon__lateral-cabecera">
        <div class="armazon__marca"><slot name="encabezado" /></div>
        <button
          ref="botonMenu"
          type="button"
          class="armazon__menu"
          :aria-expanded="menuAbierto"
          :aria-controls="idPanel"
          :aria-label="menuAbierto ? etiquetaCerrarMenu : etiquetaAbrirMenu"
          @click="alternarMenu"
        >
          <IconoFz :nombre="menuAbierto ? 'cerrar' : 'menu'" tamano="sm" />
          <span>{{ textoMenu }}</span>
        </button>
      </div>
      <div :id="idPanel" :class="['armazon__panel', { 'armazon__panel--abierto': menuAbierto }]" @click="alHacerClicEnPanel">
        <nav v-if="$slots.navegacion" class="armazon__navegacion" :aria-label="etiquetaNavegacion">
          <slot name="navegacion" />
        </nav>
        <div v-if="$slots.acciones" class="armazon__acciones"><slot name="acciones" /></div>
        <div v-if="$slots.pie" class="armazon__pie"><slot name="pie" /></div>
      </div>
    </header>

    <header v-else class="armazon__encabezado">
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

.armazon__marca {
  font-size: var(--fz-armazon-marca-texto);
  font-weight: var(--fz-armazon-marca-peso);
  color: var(--fz-armazon-marca-color);
}

/* ---- Disposición 'barra-superior' ---- */
.armazon__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-armazon-relleno-y) var(--fz-armazon-separacion);
  padding: var(--fz-armazon-relleno-y) var(--fz-armazon-relleno-x);
  border-bottom: var(--fz-armazon-borde-ancho) solid var(--fz-armazon-encabezado-borde);
  background: var(--fz-armazon-encabezado-fondo);
}

.armazon__encabezado .armazon__marca {
  order: 1;
}

.armazon__encabezado .armazon__acciones {
  order: 2;
  margin-left: auto;
}

/* En ancho chico la navegación pasa a su propia fila y sus enlaces envuelven. */
.armazon__encabezado .armazon__navegacion {
  order: 3;
  flex: 1 1 100%;
}

@media (min-width: 40rem) {
  .armazon__encabezado .armazon__navegacion {
    order: 2;
    flex: 1 1 auto;
  }

  .armazon__encabezado .armazon__acciones {
    order: 3;
  }
}

/* ---- Disposición 'barra-lateral' ---- */
/* En ancho chico es una barra superior con el botón de menú; el panel de links se despliega debajo. */
.armazon__lateral {
  background: var(--fz-armazon-barra-fondo);
  border-bottom: var(--fz-armazon-borde-ancho) solid var(--fz-armazon-barra-borde);
}

.armazon__lateral-cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-armazon-separacion);
  padding: var(--fz-armazon-relleno-y) var(--fz-armazon-barra-relleno);
}

.armazon__menu {
  display: inline-flex;
  align-items: center;
  gap: var(--fz-armazon-enlace-separacion);
  min-height: var(--fz-armazon-enlace-alto-min);
  padding: 0 var(--fz-armazon-enlace-relleno-x);
  border: var(--fz-armazon-borde-ancho) solid var(--fz-armazon-menu-borde);
  border-radius: var(--fz-armazon-enlace-radio);
  background: var(--fz-armazon-menu-fondo);
  color: var(--fz-armazon-menu-texto);
  font-family: inherit;
  font-size: var(--fz-armazon-enlace-texto);
  cursor: pointer;
}

.armazon__menu:hover {
  background: var(--fz-armazon-menu-fondo-hover);
}

.armazon__menu:focus-visible {
  outline: var(--fz-armazon-foco-ancho) solid var(--fz-armazon-foco-color);
  outline-offset: var(--fz-armazon-foco-separacion);
}

.armazon__panel {
  display: none;
  flex-direction: column;
  gap: var(--fz-armazon-barra-separacion);
  padding: 0 var(--fz-armazon-barra-relleno) var(--fz-armazon-barra-relleno);
}

.armazon__panel--abierto {
  display: flex;
}

.armazon__lateral .armazon__pie {
  padding-top: var(--fz-armazon-barra-relleno);
  border-top: var(--fz-armazon-borde-ancho) solid var(--fz-armazon-barra-borde);
}

@media (min-width: 48rem) {
  .armazon--barra-lateral {
    display: grid;
    grid-template-columns: var(--fz-armazon-barra-ancho) minmax(0, 1fr);
    align-items: start;
  }

  /* El scroll lo hace la página: la barra queda fija a la altura de la ventana. */
  .armazon__lateral {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    overflow-y: auto;
    border-right: var(--fz-armazon-borde-ancho) solid var(--fz-armazon-barra-borde);
    border-bottom: none;
  }

  .armazon__lateral-cabecera {
    padding: var(--fz-armazon-barra-relleno);
  }

  .armazon__menu {
    display: none;
  }

  .armazon__panel {
    display: flex;
    flex: 1 1 auto;
  }

  .armazon__lateral .armazon__navegacion {
    flex: 1 1 auto;
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
