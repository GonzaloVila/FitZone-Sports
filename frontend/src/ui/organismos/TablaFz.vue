<script setup lang="ts" generic="T extends object">
import type { ColumnaTabla } from './tipos'

defineProps<{
  // Título de la tabla (<caption>): lo anuncian los lectores de pantalla aunque esté oculto.
  titulo: string
  columnas: ColumnaTabla[]
  filas: T[]
  claveFila: (fila: T) => string | number
  ocultarTitulo?: boolean
  // Indica que el contenido se está actualizando (aria-busy).
  ocupada?: boolean
}>()

defineSlots<{
  [celda: `celda-${string}`]: (props: { fila: T }) => unknown
}>()

function valorDeCelda(fila: T, clave: string): unknown {
  return (fila as Record<string, unknown>)[clave]
}
</script>

<template>
  <!-- La región es desplazable en ancho chico: tiene que poder recibir foco para usarse con teclado. -->
  <div class="tabla" role="region" :aria-label="titulo" tabindex="0">
    <table class="tabla__tabla" :aria-busy="ocupada || undefined">
      <caption :class="['tabla__titulo', { 'tabla__titulo--oculto': ocultarTitulo }]">
        {{ titulo }}
      </caption>
      <thead>
        <tr>
          <th v-for="columna in columnas" :key="columna.clave" scope="col" class="tabla__encabezado">
            {{ columna.etiqueta }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="fila in filas" :key="claveFila(fila)" class="tabla__fila">
          <template v-for="columna in columnas" :key="columna.clave">
            <th v-if="columna.encabezadoFila" scope="row" class="tabla__celda tabla__celda--encabezado">
              <slot :name="`celda-${columna.clave}`" :fila="fila">{{ valorDeCelda(fila, columna.clave) }}</slot>
            </th>
            <td v-else class="tabla__celda">
              <slot :name="`celda-${columna.clave}`" :fila="fila">{{ valorDeCelda(fila, columna.clave) }}</slot>
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.tabla {
  overflow-x: auto;
  border: var(--fz-tabla-borde-ancho) solid var(--fz-tabla-borde);
  border-radius: var(--fz-tabla-radio);
  background: var(--fz-tabla-fondo);
}

.tabla:focus-visible {
  outline: var(--fz-tabla-foco-ancho) solid var(--fz-tabla-foco-color);
  outline-offset: var(--fz-tabla-foco-separacion);
}

.tabla__tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fz-tabla-texto);
  text-align: left;
}

.tabla__titulo {
  padding: var(--fz-tabla-celda-relleno-y) var(--fz-tabla-celda-relleno-x);
  color: var(--fz-tabla-titulo-color);
  text-align: left;
}

/* Oculto a la vista pero disponible para lectores de pantalla. */
.tabla__titulo--oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.tabla__encabezado {
  padding: var(--fz-tabla-celda-relleno-y) var(--fz-tabla-celda-relleno-x);
  background: var(--fz-tabla-encabezado-fondo);
  color: var(--fz-tabla-encabezado-texto);
  font-weight: var(--fz-tabla-encabezado-peso);
  white-space: nowrap;
}

.tabla__fila {
  border-top: var(--fz-tabla-borde-ancho) solid var(--fz-tabla-borde);
}

.tabla__celda {
  padding: var(--fz-tabla-celda-relleno-y) var(--fz-tabla-celda-relleno-x);
  color: var(--fz-tabla-celda-texto);
  vertical-align: middle;
}

.tabla__celda--encabezado {
  font-weight: var(--fz-tabla-encabezado-peso);
  text-align: left;
}
</style>
