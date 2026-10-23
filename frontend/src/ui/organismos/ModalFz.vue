<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const props = defineProps<{
  titulo: string
  // Mientras hay una acción en curso el modal no se puede cerrar (ni con Esc).
  ocupado?: boolean
}>()

const abierto = defineModel<boolean>({ default: false })

const dialogo = ref<HTMLDialogElement | null>(null)
const idTitulo = useId()
let elementoPrevio: HTMLElement | null = null

function abrir() {
  const dialog = dialogo.value
  if (!dialog || dialog.open) return
  elementoPrevio = document.activeElement instanceof HTMLElement ? document.activeElement : null
  dialog.showModal()
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
  <dialog ref="dialogo" class="modal" :aria-labelledby="idTitulo" @cancel="alCancelar" @close="alCerrarse">
    <div class="modal__contenido">
      <h2 :id="idTitulo" class="modal__titulo">{{ titulo }}</h2>
      <div class="modal__cuerpo"><slot /></div>
      <div class="modal__acciones"><slot name="acciones" :cerrar="pedirCierre" /></div>
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  width: min(var(--fz-modal-ancho-max), calc(100% - 2 * var(--fz-modal-margen)));
  max-height: calc(100dvh - 2 * var(--fz-modal-margen));
  padding: 0;
  overflow: auto;
  border: var(--fz-modal-borde-ancho) solid var(--fz-modal-borde);
  border-radius: var(--fz-modal-radio);
  background: var(--fz-modal-fondo);
  color: var(--fz-modal-texto);
  box-shadow: var(--fz-modal-sombra);
}

.modal::backdrop {
  background: var(--fz-modal-velo);
  opacity: var(--fz-modal-velo-opacidad);
}

.modal__contenido {
  display: flex;
  flex-direction: column;
  gap: var(--fz-modal-separacion);
  padding: var(--fz-modal-relleno);
}

.modal__titulo {
  margin: 0;
  font-size: var(--fz-modal-titulo-texto);
  font-weight: var(--fz-modal-titulo-peso);
}

.modal__cuerpo {
  display: flex;
  flex-direction: column;
  gap: var(--fz-modal-separacion);
}

.modal__acciones {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--fz-modal-separacion);
}
</style>
