<script lang="ts">
export interface OpcionSegmentadaFz {
  valor: string
  etiqueta: string
}
</script>

<script setup lang="ts">
defineProps<{
  opciones: OpcionSegmentadaFz[]
  // Atributo name de los radios (el mismo para todo el grupo).
  nombre: string
  // Nombre accesible del grupo: va en un <legend> oculto a la vista.
  leyenda: string
  deshabilitado?: boolean
}>()

const modelo = defineModel<string>({ required: true })
</script>

<template>
  <fieldset class="segmentado" :disabled="deshabilitado">
    <legend class="segmentado__leyenda">{{ leyenda }}</legend>
    <label v-for="opcion in opciones" :key="opcion.valor" class="segmentado__opcion">
      <input
        class="segmentado__radio"
        type="radio"
        :name="nombre"
        :value="opcion.valor"
        :checked="modelo === opcion.valor"
        @change="modelo = opcion.valor"
      />
      <span class="segmentado__etiqueta">{{ opcion.etiqueta }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.segmentado {
  display: flex;
  gap: var(--fz-selector-segmentado-relleno);
  min-width: 0;
  margin: 0;
  padding: var(--fz-selector-segmentado-relleno);
  border: none;
  border-radius: var(--fz-selector-segmentado-radio);
  background: var(--fz-selector-segmentado-fondo);
}

/* Oculta a la vista pero disponible para lectores de pantalla. */
.segmentado__leyenda {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.segmentado__opcion {
  position: relative;
  display: flex;
  flex: 1;
}

/* El radio nativo sigue en el DOM y recibe el foco y las flechas; solo se saca de la vista. */
.segmentado__radio {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
}

.segmentado__etiqueta {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: var(--fz-selector-segmentado-alto);
  padding: 0 var(--fz-espaciado-base);
  border: var(--fz-selector-segmentado-borde-ancho) solid transparent;
  border-radius: var(--fz-selector-segmentado-radio);
  color: var(--fz-selector-segmentado-color);
  font-size: var(--fz-selector-segmentado-texto);
  font-weight: var(--fz-selector-segmentado-peso);
  cursor: pointer;
  user-select: none;
}

.segmentado__opcion:hover .segmentado__etiqueta {
  color: var(--fz-selector-segmentado-color-hover);
}

.segmentado__radio:checked + .segmentado__etiqueta {
  border-color: var(--fz-selector-segmentado-elegida-borde);
  background: var(--fz-selector-segmentado-elegida-fondo);
  color: var(--fz-selector-segmentado-elegida-color);
}

.segmentado__radio:focus-visible + .segmentado__etiqueta {
  outline: var(--fz-selector-segmentado-foco-ancho) solid var(--fz-selector-segmentado-foco-color);
  outline-offset: var(--fz-selector-segmentado-foco-separacion);
}

.segmentado:disabled {
  opacity: var(--fz-selector-segmentado-deshabilitado-opacidad);
}

.segmentado:disabled .segmentado__etiqueta {
  cursor: not-allowed;
}
</style>
