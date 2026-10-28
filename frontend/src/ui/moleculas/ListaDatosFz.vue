<script lang="ts">
export interface DatoFz {
  etiqueta: string
  valor: string
  // Resalta el valor (más grande y con énfasis), por ejemplo un monto.
  destacado?: boolean
}
</script>

<script setup lang="ts">
defineProps<{
  datos: DatoFz[]
}>()
</script>

<template>
  <dl class="lista-datos">
    <template v-for="dato in datos" :key="dato.etiqueta">
      <dt class="lista-datos__etiqueta">{{ dato.etiqueta }}</dt>
      <dd :class="['lista-datos__valor', { 'lista-datos__valor--destacado': dato.destacado }]">{{ dato.valor }}</dd>
    </template>
  </dl>
</template>

<style scoped>
/* Una grilla de dos columnas: la de las etiquetas mide la etiqueta más larga (ancho común) y el valor queda pegado a ella. */
.lista-datos {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  column-gap: var(--fz-lista-datos-separacion-x);
  row-gap: var(--fz-lista-datos-separacion-y);
  margin: 0;
}

.lista-datos__etiqueta {
  color: var(--fz-lista-datos-etiqueta-color);
  font-size: var(--fz-lista-datos-etiqueta-texto);
}

.lista-datos__valor {
  margin: 0;
  color: var(--fz-lista-datos-valor-color);
  font-size: var(--fz-lista-datos-valor-texto);
  font-weight: var(--fz-lista-datos-valor-peso);
  overflow-wrap: anywhere;
}

.lista-datos__valor--destacado {
  font-size: var(--fz-lista-datos-destacado-texto);
  font-weight: var(--fz-lista-datos-destacado-peso);
}
</style>
