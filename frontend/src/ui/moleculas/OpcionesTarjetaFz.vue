<script lang="ts">
export interface OpcionTarjetaFz {
  valor: string
  titulo: string
  descripcion?: string
  // Insignia pequeña a la derecha (ej. "Más elegido").
  etiqueta?: string
}
</script>

<script setup lang="ts">
import InsigniaFz from '../atomos/InsigniaFz.vue'

defineProps<{
  opciones: OpcionTarjetaFz[]
  // Atributo name de los radios (el mismo para todo el grupo).
  nombre: string
  // Nombre accesible del grupo: va en un <legend> oculto a la vista.
  leyenda: string
  deshabilitado?: boolean
}>()

const modelo = defineModel<string>({ required: true })
</script>

<template>
  <fieldset class="opciones">
    <legend class="opciones__leyenda">{{ leyenda }}</legend>
    <label
      v-for="opcion in opciones"
      :key="opcion.valor"
      :class="['opcion', { 'opcion--elegida': modelo === opcion.valor, 'opcion--deshabilitada': deshabilitado }]"
    >
      <input
        class="opcion__radio"
        type="radio"
        :name="nombre"
        :value="opcion.valor"
        :checked="modelo === opcion.valor"
        :disabled="deshabilitado"
        @change="modelo = opcion.valor"
      />
      <span class="opcion__indicador" aria-hidden="true" />
      <span class="opcion__texto">
        <span class="opcion__titulo">{{ opcion.titulo }}</span>
        <span v-if="opcion.descripcion" class="opcion__descripcion">{{ opcion.descripcion }}</span>
      </span>
      <InsigniaFz v-if="opcion.etiqueta">{{ opcion.etiqueta }}</InsigniaFz>
    </label>
  </fieldset>
</template>

<style scoped>
.opciones {
  display: flex;
  flex-direction: column;
  gap: var(--fz-opcion-tarjeta-separacion);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
}

/* Oculta a la vista pero disponible para lectores de pantalla. */
.opciones__leyenda {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.opcion {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--fz-opcion-tarjeta-contenido-separacion);
  padding: var(--fz-opcion-tarjeta-relleno-y) var(--fz-opcion-tarjeta-relleno-x);
  border: var(--fz-opcion-tarjeta-borde-ancho) solid var(--fz-opcion-tarjeta-borde);
  border-radius: var(--fz-opcion-tarjeta-radio);
  background: var(--fz-opcion-tarjeta-fondo);
  cursor: pointer;
}

/* El radio nativo sigue en el DOM y recibe el foco; solo se saca de la vista. */
.opcion__radio {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
}

.opcion:hover:not(.opcion--elegida):not(.opcion--deshabilitada) {
  border-color: var(--fz-opcion-tarjeta-borde-hover);
  background: var(--fz-opcion-tarjeta-fondo-hover);
}

.opcion--elegida {
  border-color: var(--fz-opcion-tarjeta-elegida-borde);
  background: var(--fz-opcion-tarjeta-elegida-fondo);
}

/* Foco de teclado: anillo sobre la tarjeta entera. */
.opcion:has(.opcion__radio:focus-visible) {
  outline: var(--fz-opcion-tarjeta-foco-ancho) solid var(--fz-opcion-tarjeta-foco-color);
  outline-offset: var(--fz-opcion-tarjeta-foco-separacion);
}

.opcion--deshabilitada {
  opacity: var(--fz-opcion-tarjeta-deshabilitada-opacidad);
  cursor: not-allowed;
}

.opcion__indicador {
  flex: none;
  box-sizing: border-box;
  width: var(--fz-opcion-tarjeta-indicador-tamano);
  height: var(--fz-opcion-tarjeta-indicador-tamano);
  border: var(--fz-opcion-tarjeta-borde-ancho) solid var(--fz-opcion-tarjeta-indicador-borde);
  border-radius: var(--fz-radio-pildora);
  background: var(--fz-opcion-tarjeta-fondo);
}

/* Elegida: círculo relleno con un anillo claro por dentro. */
.opcion--elegida .opcion__indicador {
  border-color: var(--fz-opcion-tarjeta-indicador-elegido);
  background: var(--fz-opcion-tarjeta-indicador-elegido);
  box-shadow: inset 0 0 0 var(--fz-opcion-tarjeta-indicador-hueco-ancho) var(--fz-opcion-tarjeta-indicador-hueco);
}

.opcion__texto {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.opcion__titulo {
  color: var(--fz-opcion-tarjeta-titulo-color);
  font-size: var(--fz-opcion-tarjeta-titulo-texto);
  font-weight: var(--fz-opcion-tarjeta-titulo-peso);
}

.opcion__descripcion {
  color: var(--fz-opcion-tarjeta-descripcion-color);
  font-size: var(--fz-opcion-tarjeta-descripcion-texto);
}
</style>
