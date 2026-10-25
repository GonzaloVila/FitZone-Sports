<script setup lang="ts">
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastTitle, ToastViewport } from 'reka-ui'
import IconoFz from '../atomos/IconoFz.vue'
import { useAvisosFz } from '../composables/useAvisosFz'

// Se monta una sola vez (en App.vue). Lee la cola compartida de useAvisosFz().
const { avisos, cerrar, pausar, reanudar } = useAvisosFz()

function alCambiarApertura(id: number, abierto: boolean) {
  if (!abierto) cerrar(id)
}
</script>

<template>
  <ToastProvider swipe-direction="right">
    <!--
      El tiempo de vida lo lleva useAvisosFz (duration infinita para Reka); Reka avisa con pause/resume
      cuando el puntero o el foco están sobre un aviso, y ahí se pausa el temporizador.
    -->
    <ToastRoot
      v-for="aviso in avisos"
      :key="aviso.id"
      :open="true"
      :type="aviso.tipo === 'error' ? 'foreground' : 'background'"
      :duration="Number.POSITIVE_INFINITY"
      :class="['aviso-flotante', `aviso-flotante--${aviso.tipo}`]"
      @update:open="(abierto: boolean) => alCambiarApertura(aviso.id, abierto)"
      @pause="pausar(aviso.id)"
      @resume="reanudar(aviso.id)"
    >
      <IconoFz :nombre="aviso.tipo" class="aviso-flotante__icono" />
      <div class="aviso-flotante__cuerpo">
        <ToastTitle class="aviso-flotante__titulo">{{ aviso.titulo }}</ToastTitle>
        <ToastDescription v-if="aviso.descripcion" class="aviso-flotante__descripcion">
          {{ aviso.descripcion }}
        </ToastDescription>
      </div>
      <ToastClose class="aviso-flotante__cerrar" aria-label="Cerrar aviso">
        <IconoFz nombre="cerrar" tamano="sm" />
      </ToastClose>
    </ToastRoot>
    <ToastViewport class="avisos-flotantes" :label="(tecla: string) => `Avisos (${tecla})`" />
  </ToastProvider>
</template>

<style>
/*
 * Sin scoped a propósito: Reka dibuja un envoltorio propio (la región del Viewport, que contiene el <ol> y los avisos) que recibe el atributo data-v del
 * componente, y nuestra clase cae en el elemento interno, que no lo recibe. Con scoped esos estilos no se
 * aplican. Las clases llevan el prefijo del componente para que no se crucen con otras.
 */
/* Abajo a la derecha; en ancho chico, a todo el ancho menos el margen. */
.avisos-flotantes {
  position: fixed;
  right: var(--fz-aviso-flotante-margen);
  bottom: var(--fz-aviso-flotante-margen);
  left: var(--fz-aviso-flotante-margen);
  z-index: var(--fz-aviso-flotante-capa);
  display: flex;
  flex-direction: column;
  gap: var(--fz-aviso-flotante-separacion);
  margin: 0;
  padding: 0;
  list-style: none;
  outline: none;
}

@media (min-width: 40rem) {
  .avisos-flotantes {
    left: auto;
    width: var(--fz-aviso-flotante-ancho-max);
    max-width: calc(100vw - 2 * var(--fz-aviso-flotante-margen));
  }
}

.aviso-flotante {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--fz-aviso-flotante-contenido-separacion);
  padding: var(--fz-aviso-flotante-relleno-y) var(--fz-aviso-flotante-relleno-x);
  border: var(--fz-aviso-flotante-borde-ancho) solid var(--fz-aviso-flotante-borde);
  border-radius: var(--fz-aviso-flotante-radio);
  background: var(--fz-aviso-flotante-fondo);
  box-shadow: var(--fz-aviso-flotante-sombra);
  animation: aviso-flotante-entrada var(--fz-aviso-flotante-animacion-duracion) ease-out;
}

.aviso-flotante--exito {
  --fz-aviso-flotante-acento: var(--fz-aviso-flotante-exito-color);
}

.aviso-flotante--error {
  --fz-aviso-flotante-acento: var(--fz-aviso-flotante-error-color);
}

.aviso-flotante--info {
  --fz-aviso-flotante-acento: var(--fz-aviso-flotante-info-color);
}

.aviso-flotante__icono {
  color: var(--fz-aviso-flotante-acento);
  /* Alinea el ícono con la primera línea del título. */
  margin-top: 0.0625rem;
}

.aviso-flotante__cuerpo {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.aviso-flotante__titulo {
  font-size: var(--fz-aviso-flotante-titulo-texto);
  font-weight: var(--fz-aviso-flotante-titulo-peso);
  color: var(--fz-aviso-flotante-titulo-color);
}

.aviso-flotante__descripcion {
  font-size: var(--fz-aviso-flotante-descripcion-texto);
  color: var(--fz-aviso-flotante-descripcion-color);
}

.aviso-flotante__cerrar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--fz-aviso-flotante-cerrar-tamano);
  height: var(--fz-aviso-flotante-cerrar-tamano);
  margin: calc(-1 * var(--fz-aviso-flotante-contenido-separacion)) 0;
  padding: 0;
  border: none;
  border-radius: var(--fz-radio-control);
  background: transparent;
  color: var(--fz-aviso-flotante-cerrar-color);
  cursor: pointer;
}

.aviso-flotante__cerrar:hover {
  background: var(--fz-aviso-flotante-cerrar-fondo-hover);
  color: var(--fz-aviso-flotante-cerrar-color-hover);
}

.aviso-flotante__cerrar:focus-visible {
  outline: var(--fz-aviso-flotante-foco-ancho) solid var(--fz-aviso-flotante-foco-color);
  outline-offset: var(--fz-aviso-flotante-foco-separacion);
}

@keyframes aviso-flotante-entrada {
  from {
    opacity: 0;
    transform: translateY(var(--fz-aviso-flotante-animacion-desplazamiento));
  }
}

@media (prefers-reduced-motion: reduce) {
  .aviso-flotante {
    animation: none;
  }
}
</style>
