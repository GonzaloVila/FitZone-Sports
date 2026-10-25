<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import BotonFz from '../atomos/BotonFz.vue'
import IconoFz from '../atomos/IconoFz.vue'
import type { NombreIconoFz } from '../atomos/IconoFz.vue'

const props = withDefaults(
  defineProps<{
    titulo: string
    // Subtítulo pequeño y gris, bajo el título.
    descripcion?: string
    // Ícono del encabezado, dentro de una cajita del color del tono.
    icono?: NombreIconoFz
    tono?: 'neutro' | 'primario' | 'advertencia' | 'peligro'
    ancho?: 'angosto' | 'normal' | 'amplio'
    // Mientras hay una acción en curso el modal no se puede cerrar (ni con Esc ni con la X).
    ocupado?: boolean
  }>(),
  {
    tono: 'neutro',
    ancho: 'normal',
  },
)

const abierto = defineModel<boolean>({ default: false })

const dialogo = ref<HTMLDialogElement | null>(null)
const idTitulo = useId()
const idDescripcion = useId()
let elementoPrevio: HTMLElement | null = null

function abrir() {
  const dialog = dialogo.value
  if (!dialog || dialog.open) return
  elementoPrevio = document.activeElement instanceof HTMLElement ? document.activeElement : null
  dialog.showModal()
  enfocarInicial(dialog)
}

const FOCALIZABLE =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

// El navegador enfoca el primer elemento del diálogo, que ahora sería la X del encabezado. El foco inicial va
// al primer control del cuerpo (o su opción elegida, si es un grupo de radios) y, si no hay, al primer botón del pie.
// Sin ninguno, queda lo que decida el navegador.
function enfocarInicial(dialog: HTMLDialogElement) {
  const destino = dialog.querySelector<HTMLElement>(`.modal__cuerpo :is(${FOCALIZABLE}), .modal__pie :is(${FOCALIZABLE})`)
  if (!destino) return
  const elegido =
    destino instanceof HTMLInputElement && destino.type === 'radio' && destino.name
      ? [...dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked')].find((radio) => radio.name === destino.name)
      : undefined
  ;(elegido ?? destino).focus()
}

function cerrar() {
  const dialog = dialogo.value
  if (dialog?.open) dialog.close()
  // Devuelve el foco a quien abrió el modal.
  elementoPrevio?.focus()
  elementoPrevio = null
}

watch(abierto, (valor) => (valor ? abrir() : cerrar()), { flush: 'post' })
onMounted(() => {
  if (abierto.value) abrir()
})
onBeforeUnmount(() => dialogo.value?.close())

// Esc dispara `cancel`: se frena si hay una acción en curso.
function alCancelar(evento: Event) {
  if (props.ocupado) evento.preventDefault()
}

// El navegador cerró el dialog (Esc, o un segundo Esc que algunos navegadores no dejan frenar).
// Si había una acción en curso, se reabre; si no, se sincroniza el estado.
function alCerrarse() {
  if (props.ocupado && abierto.value) {
    dialogo.value?.showModal()
    return
  }
  abierto.value = false
}

function pedirCierre() {
  if (!props.ocupado) abierto.value = false
}
</script>

<template>
  <dialog
    ref="dialogo"
    :class="['modal', `modal--${ancho}`]"
    :aria-labelledby="idTitulo"
    :aria-describedby="descripcion ? idDescripcion : undefined"
    @cancel="alCancelar"
    @close="alCerrarse"
  >
    <header class="modal__encabezado">
      <span v-if="icono" :class="['modal__icono', `modal__icono--${tono}`]" aria-hidden="true">
        <IconoFz :nombre="icono" tamano="sm" />
      </span>
      <div class="modal__titulos">
        <h2 :id="idTitulo" class="modal__titulo">{{ titulo }}</h2>
        <p v-if="descripcion" :id="idDescripcion" class="modal__descripcion">{{ descripcion }}</p>
      </div>
      <BotonFz variante="fantasma" tamano="sm" aria-label="Cerrar" :disabled="ocupado" @click="pedirCierre">
        <IconoFz nombre="cerrar" tamano="sm" />
      </BotonFz>
    </header>
    <div class="modal__cuerpo"><slot /></div>
    <footer v-if="$slots.acciones" class="modal__pie"><slot name="acciones" :cerrar="pedirCierre" /></footer>
  </dialog>
</template>

<style scoped>
.modal {
  max-height: calc(100dvh - 2 * var(--fz-modal-margen));
  padding: 0;
  overflow: hidden;
  border: var(--fz-modal-borde-ancho) solid var(--fz-modal-borde);
  border-radius: var(--fz-modal-radio);
  background: var(--fz-modal-fondo);
  color: var(--fz-modal-texto);
  box-shadow: var(--fz-modal-sombra);
}

/*
 * El propio <dialog> recibe el foco cuando no hay nada enfocable (todo deshabilitado u ocupado) y el navegador le
 * dibuja un contorno que es solo ruido: no es un control. Los botones y campos de adentro conservan el suyo.
 */
.modal:focus-visible {
  outline: none;
}

/* Columna: el encabezado y el pie quedan a la vista y solo el cuerpo se desplaza. */
.modal[open] {
  display: flex;
  flex-direction: column;
}

.modal--angosto {
  width: min(var(--fz-modal-ancho-angosto), calc(100% - 2 * var(--fz-modal-margen)));
}

.modal--normal {
  width: min(var(--fz-modal-ancho-normal), calc(100% - 2 * var(--fz-modal-margen)));
}

.modal--amplio {
  width: min(var(--fz-modal-ancho-amplio), calc(100% - 2 * var(--fz-modal-margen)));
}

.modal::backdrop {
  background: color-mix(in srgb, var(--fz-modal-velo) var(--fz-modal-velo-opacidad), transparent);
  backdrop-filter: blur(var(--fz-modal-desenfoque));
}

.modal__encabezado {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--fz-modal-encabezado-separacion);
  padding: var(--fz-modal-encabezado-relleno-y) var(--fz-modal-encabezado-relleno-x);
  border-bottom: var(--fz-modal-encabezado-borde-ancho) solid var(--fz-modal-encabezado-borde);
}

.modal__icono {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--fz-modal-icono-tamano);
  height: var(--fz-modal-icono-tamano);
  border-radius: var(--fz-modal-icono-radio);
}

.modal__icono--neutro {
  background: var(--fz-modal-tono-neutro-fondo);
  color: var(--fz-modal-tono-neutro-icono);
}

.modal__icono--primario {
  background: var(--fz-modal-tono-primario-fondo);
  color: var(--fz-modal-tono-primario-icono);
}

.modal__icono--advertencia {
  background: var(--fz-modal-tono-advertencia-fondo);
  color: var(--fz-modal-tono-advertencia-icono);
}

.modal__icono--peligro {
  background: var(--fz-modal-tono-peligro-fondo);
  color: var(--fz-modal-tono-peligro-icono);
}

.modal__titulos {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.modal__titulo {
  margin: 0;
  font-size: var(--fz-modal-titulo-texto);
  font-weight: var(--fz-modal-titulo-peso);
  letter-spacing: var(--fz-modal-titulo-letras);
}

.modal__descripcion {
  margin: 0;
  color: var(--fz-modal-descripcion-color);
  font-size: var(--fz-modal-descripcion-texto);
}

.modal__cuerpo {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--fz-modal-separacion);
  min-height: 0;
  padding: var(--fz-modal-relleno);
  overflow: auto;
}

.modal__pie {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--fz-modal-pie-separacion);
  padding: var(--fz-modal-pie-relleno-y) var(--fz-modal-pie-relleno-x);
  border-top: var(--fz-modal-pie-borde-ancho) solid var(--fz-modal-pie-borde);
  background: var(--fz-modal-pie-fondo);
}
</style>
