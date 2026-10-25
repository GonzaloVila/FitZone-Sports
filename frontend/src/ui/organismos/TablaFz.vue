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

// La región (div raíz) es desplazable en ancho chico: tiene que poder recibir foco para usarse con teclado.

// Clases de una columna para su encabezado (base 'tabla__encabezado') o sus celdas (base 'tabla__celda').
function clasesDeColumna(base: string, columna: ColumnaTabla) {
  return {
    [`${base}--ajustada`]: columna.ajustada,
    [`${base}--${columna.alineacion}`]: columna.alineacion !== undefined && columna.alineacion !== 'inicio',
  }
}

function valorDeCelda(fila: T, clave: string): unknown {
  return (fila as Record<string, unknown>)[clave]
}
</script>

<template>
  <div class="tabla" role="region" :aria-label="titulo" tabindex="0">
    <table class="tabla__tabla" :aria-busy="ocupada || undefined">
      <caption :class="['tabla__titulo', { 'tabla__titulo--oculto': ocultarTitulo }]">
        {{ titulo }}
      </caption>
      <thead>
        <tr>
          <th
            v-for="columna in columnas"
            :key="columna.clave"
            scope="col"
            :class="['tabla__encabezado', clasesDeColumna('tabla__encabezado', columna), { 'tabla__encabezado--en-lineas': columna.encabezadoEnLineas }]"
          >
            {{ columna.etiqueta }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="fila in filas" :key="claveFila(fila)" class="tabla__fila">
          <template v-for="columna in columnas" :key="columna.clave">
            <th
              v-if="columna.encabezadoFila"
              scope="row"
              :class="['tabla__celda', 'tabla__celda--encabezado', clasesDeColumna('tabla__celda', columna)]"
            >
              <slot :name="`celda-${columna.clave}`" :fila="fila">{{ valorDeCelda(fila, columna.clave) }}</slot>
            </th>
            <td v-else :class="['tabla__celda', clasesDeColumna('tabla__celda', columna)]">
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
  box-shadow: var(--fz-tabla-sombra);
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
  padding: var(--fz-tabla-encabezado-relleno-y) var(--fz-tabla-encabezado-relleno-x);
  background: var(--fz-tabla-encabezado-fondo);
  color: var(--fz-tabla-encabezado-texto);
  font-size: var(--fz-tabla-encabezado-tamano);
  font-weight: var(--fz-tabla-encabezado-peso);
  white-space: nowrap;
}

.tabla__fila {
  border-top: var(--fz-tabla-borde-ancho) solid var(--fz-tabla-borde);
}

.tabla__fila:hover {
  background: var(--fz-tabla-fila-fondo-hover);
}

.tabla__celda {
  padding: var(--fz-tabla-celda-relleno-y) var(--fz-tabla-celda-relleno-x);
  color: var(--fz-tabla-celda-texto);
  vertical-align: middle;
}

.tabla__celda--encabezado {
  font-weight: var(--fz-tabla-celda-encabezado-peso);
  text-align: left;
}

/* Columnas ajustadas: width 1% hace que ocupen su contenido mínimo y el resto del ancho vaya a las demás. */
.tabla__encabezado--ajustada,
.tabla__celda--ajustada {
  width: 1%;
}

.tabla__celda--ajustada {
  white-space: nowrap;
}

.tabla__encabezado--en-lineas {
  white-space: normal;
  text-wrap: balance;
}

.tabla__encabezado--centro,
.tabla__celda--centro {
  text-align: center;
}

.tabla__encabezado--fin,
.tabla__celda--fin {
  text-align: end;
}
</style>
