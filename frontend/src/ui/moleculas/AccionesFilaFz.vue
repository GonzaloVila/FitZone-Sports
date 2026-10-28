<script lang="ts">
import type { NombreIconoFz } from '../atomos/IconoFz.vue'

export interface AccionFilaFz {
  clave: string
  // Texto corto: el tooltip del botón y el ítem del menú.
  etiqueta: string
  // El nombre accesible del botón de ícono; por defecto la `etiqueta`. La tabla lo completa con el dato de la fila
  // ("Cancelar reserva de Fútbol 5 #2").
  etiquetaAccesible?: string
  icono: NombreIconoFz
  peligro?: boolean
  deshabilitada?: boolean
  // Muestra el estado de carga del botón (solo en modo íconos).
  cargando?: boolean
  // Línea fina antes del ítem (solo en modo menú).
  separada?: boolean
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import BotonFz from '../atomos/BotonFz.vue'
import IconoFz from '../atomos/IconoFz.vue'
import MenuAccionesFz, { type AccionMenuFz } from './MenuAccionesFz.vue'

// Con tantas acciones o más, las de la fila van en un único menú "···".
const MINIMO_PARA_MENU = 3

const props = defineProps<{
  acciones: AccionFilaFz[]
  // La cantidad MÁXIMA de acciones que puede tener cualquier fila de la tabla (no las de esta fila), para que todas se vean
  // iguales.
  maximo: number
  // Nombre accesible del grupo ("Acciones de Fútbol 5 #2").
  etiqueta: string
  // Base de los `data-identificador` para devolver el foco (ver `enfocarControlDeFila`).
  identificador?: string
}>()

const emit = defineEmits<{ seleccionar: [clave: string] }>()

const comoMenu = computed(() => props.maximo >= MINIMO_PARA_MENU)

const accionesDelMenu = computed<AccionMenuFz[]>(() =>
  props.acciones.map(({ clave, etiqueta, icono, peligro, deshabilitada, separada }) => ({
    clave,
    etiqueta,
    icono,
    peligro,
    deshabilitada,
    separada,
  })),
)
</script>

<template>
  <template v-if="acciones.length > 0">
    <MenuAccionesFz
      v-if="comoMenu"
      :etiqueta="etiqueta"
      :identificador="identificador"
      :acciones="accionesDelMenu"
      @seleccionar="(clave) => emit('seleccionar', clave)"
    />

    <div v-else class="acciones-fila" role="group" :aria-label="etiqueta">
      <!-- El `title` también va en el envoltorio: un botón deshabilitado no recibe el puntero y, sin él, perdería el tooltip. -->
      <span v-for="accion in acciones" :key="accion.clave" class="acciones-fila__item" :title="accion.etiqueta">
        <BotonFz
          solo-icono
          variante="fantasma"
          tamano="sm"
          :class="{ 'acciones-fila__boton--peligro': accion.peligro }"
          :title="accion.etiqueta"
          :aria-label="accion.etiquetaAccesible ?? accion.etiqueta"
          :disabled="accion.deshabilitada"
          :cargando="accion.cargando"
          :data-identificador="identificador ? `${identificador}-${accion.clave}` : undefined"
          @click="emit('seleccionar', accion.clave)"
        >
          <IconoFz v-if="!accion.cargando" :nombre="accion.icono" tamano="sm" />
        </BotonFz>
      </span>
    </div>
  </template>
</template>

<style scoped>
.acciones-fila {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--fz-espaciado-compacto);
}

.acciones-fila__item {
  display: inline-flex;
}

.acciones-fila__boton--peligro:not(:disabled) {
  color: var(--fz-color-peligro);
}
</style>
