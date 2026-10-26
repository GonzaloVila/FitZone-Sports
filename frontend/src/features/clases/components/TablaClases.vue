<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import type { MarcaClase } from '../marcasClases'
import { estadoDeClase, formatearHorario } from '../presentacion'
import type { Clase } from '../services/servicioClases'
import MarcaDeClase from './MarcaDeClase.vue'

const props = defineProps<{
  clases: Clase[]
  nombreSede: (sedeId: number) => string
  // Parámetros de dirección del enlace al detalle (de dónde se vino y con qué filtros).
  parametrosDetalle?: Record<string, string>
  // Marca de las clases que el socio ya tiene reservadas o en espera (solo para el socio).
  marcas?: ReadonlyMap<number, MarcaClase>
  ocupada?: boolean
}>()

const columnas: ColumnaTabla[] = [
  { clave: 'tipo', etiqueta: 'Clase', encabezadoFila: true },
  { clave: 'horario', etiqueta: 'Horario' },
  { clave: 'instructor', etiqueta: 'Instructor' },
  { clave: 'sede', etiqueta: 'Sede' },
  { clave: 'cupos', etiqueta: 'Cupos libres', ajustada: true },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
]

const claveFila = (fila: Clase) => fila.id
const marcaDe = (claseId: number) => props.marcas?.get(claseId)
</script>

<template>
  <TablaFz titulo="Agenda de clases" ocultar-titulo :columnas="columnas" :filas="clases" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-tipo="{ fila }">
      <span class="tabla-clases__clase">
        <RouterLink
          :to="{ name: 'clase-detalle', params: { claseId: fila.id }, query: parametrosDetalle }"
          class="tabla-clases__enlace"
        >
          {{ fila.tipo }}
        </RouterLink>
        <MarcaDeClase v-if="marcaDe(fila.id)" :marca="marcaDe(fila.id)!" />
      </span>
    </template>
    <template #celda-horario="{ fila }">{{ formatearHorario(fila) }}</template>
    <template #celda-sede="{ fila }">{{ nombreSede(fila.sedeId) }}</template>
    <template #celda-cupos="{ fila }">{{ fila.cupoDisponible }} de {{ fila.capacidad }}</template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="estadoDeClase(fila).variante">{{ estadoDeClase(fila).etiqueta }}</InsigniaFz>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-clases__clase {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.tabla-clases__enlace {
  color: var(--fz-color-texto);
  font-weight: var(--fz-peso-enfasis);
  text-decoration: none;
}

.tabla-clases__enlace:hover {
  text-decoration: underline;
}

.tabla-clases__enlace:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}
</style>
