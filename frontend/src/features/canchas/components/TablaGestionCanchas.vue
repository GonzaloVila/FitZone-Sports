<script setup lang="ts">
import { reactive, watch } from 'vue'
import { BotonFz, CampoTextoFz, InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { ETIQUETA_ESTADO_CANCHA, ETIQUETA_TIPO_CANCHA } from '../presentacion'
import type { Cancha } from '../services/servicioCanchas'

const props = defineProps<{
  canchas: Cancha[]
  // Hay un cambio en curso: las acciones quedan bloqueadas.
  guardando?: boolean
}>()

const emit = defineEmits<{
  (e: 'mantenimiento', cancha: Cancha): void
  (e: 'costo', cancha: Cancha, costoPorHora: number): void
}>()

const columnas: ColumnaTabla[] = [
  { clave: 'tipo', etiqueta: 'Deporte', encabezadoFila: true },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
  { clave: 'costo', etiqueta: 'Costo por hora' },
  { clave: 'acciones', etiqueta: 'Mantenimiento', ajustada: true, alineacion: 'fin' },
]

// El costo que se está escribiendo en cada fila. Al recargar la lista se conserva lo escrito en las otras filas: solo se
// reescribe el de una cancha cuyo costo cambió en el servidor (la que se acaba de guardar).
const costos = reactive<Record<number, string>>({})
const costosDelServidor = new Map<number, string>()

watch(
  () => props.canchas,
  (lista) => {
    const ids = new Set(lista.map((cancha) => cancha.id))
    for (const clave of Object.keys(costos)) {
      if (!ids.has(Number(clave))) {
        delete costos[Number(clave)]
        costosDelServidor.delete(Number(clave))
      }
    }
    for (const cancha of lista) {
      const costo = String(cancha.costoPorHora)
      if (costos[cancha.id] === undefined || costosDelServidor.get(cancha.id) !== costo) costos[cancha.id] = costo
      costosDelServidor.set(cancha.id, costo)
    }
  },
  { immediate: true },
)

const claveFila = (fila: Cancha) => fila.id
const nombreDe = (cancha: Cancha) => `${ETIQUETA_TIPO_CANCHA[cancha.tipo]} #${cancha.id}`
const hayCambio = (cancha: Cancha) => costos[cancha.id] !== String(cancha.costoPorHora)
const operativa = (cancha: Cancha) => cancha.estado === 'OPERATIVA'

function guardarCosto(cancha: Cancha) {
  emit('costo', cancha, Number(costos[cancha.id]))
}
</script>

<template>
  <TablaFz titulo="Canchas de la sede" ocultar-titulo :columnas="columnas" :filas="canchas" :clave-fila="claveFila" :ocupada="guardando">
    <template #celda-tipo="{ fila }">
      <span class="tabla-gestion__nombre">{{ ETIQUETA_TIPO_CANCHA[fila.tipo] }}</span>
      <span class="tabla-gestion__id"> #{{ fila.id }}</span>
    </template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="operativa(fila) ? 'exito' : 'advertencia'">{{ ETIQUETA_ESTADO_CANCHA[fila.estado] }}</InsigniaFz>
    </template>
    <template #celda-costo="{ fila }">
      <form class="tabla-gestion__costo" novalidate @submit.prevent="guardarCosto(fila)">
        <div class="tabla-gestion__campo">
          <CampoTextoFz
            v-model="costos[fila.id]"
            tipo="number"
            tamano="sm"
            min="0"
            step="0.01"
            :aria-label="`Costo por hora de ${nombreDe(fila)}`"
            :disabled="guardando"
          />
        </div>
        <BotonFz v-if="hayCambio(fila)" tipo="submit" tamano="sm" :disabled="guardando" :aria-label="`Guardar costo de ${nombreDe(fila)}`">
          Guardar
        </BotonFz>
      </form>
    </template>
    <template #celda-acciones="{ fila }">
      <BotonFz
        tamano="sm"
        :variante="operativa(fila) ? 'secundario' : 'primario'"
        :disabled="guardando"
        :aria-label="`${operativa(fila) ? 'Pasar a mantenimiento' : 'Liberar mantenimiento'}: ${nombreDe(fila)}`"
        @click="emit('mantenimiento', fila)"
      >
        {{ operativa(fila) ? 'Pasar a mantenimiento' : 'Liberar mantenimiento' }}
      </BotonFz>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-gestion__nombre {
  font-weight: var(--fz-peso-enfasis);
}

.tabla-gestion__id {
  color: var(--fz-color-texto-suave);
}

.tabla-gestion__costo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

/* El campo mide lo justo para un monto; en ancho chico el botón pasa a otra línea. */
.tabla-gestion__campo {
  flex: 0 1 calc(5 * var(--fz-espaciado-amplio));
  min-width: 0;
}
</style>
