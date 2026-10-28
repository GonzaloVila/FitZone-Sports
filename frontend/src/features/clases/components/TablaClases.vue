<script setup lang="ts">
import { useRouter } from 'vue-router'
import { AccionesFilaFz, InsigniaFz, TablaFz, type AccionFilaFz, type ColumnaTabla } from '@/ui'
import type { MarcaClase } from '../marcasClases'
import { estadoDeClase, formatearHorario } from '../presentacion'
import type { Clase } from '../services/servicioClases'
import MarcaDeClase from './MarcaDeClase.vue'

const props = defineProps<{
  clases: Clase[]
  nombreSede: (sedeId: number) => string
  // Parámetros de dirección del detalle (de dónde se vino y con qué filtros).
  parametrosDetalle?: Record<string, string>
  // Marca de las clases que el socio ya tiene reservadas o en espera (solo para el socio).
  marcas?: ReadonlyMap<number, MarcaClase>
  ocupada?: boolean
}>()

const router = useRouter()

const columnas: ColumnaTabla[] = [
  { clave: 'tipo', etiqueta: 'Clase', encabezadoFila: true },
  { clave: 'horario', etiqueta: 'Horario' },
  { clave: 'instructor', etiqueta: 'Instructor' },
  { clave: 'sede', etiqueta: 'Sede' },
  { clave: 'cupos', etiqueta: 'Cupos libres', ajustada: true },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
  { clave: 'acciones', etiqueta: 'Acciones', etiquetaOculta: true, ajustada: true, alineacion: 'fin' },
]

// Una sola acción por fila ("Ver detalle"): es un ícono. El nombre de la clase es texto simple.
const MAXIMO_DE_ACCIONES = 1

const claveFila = (fila: Clase) => fila.id
const marcaDe = (claseId: number) => props.marcas?.get(claseId)
const accionesDe = (clase: Clase): AccionFilaFz[] => [
  { clave: 'ver-detalle', etiqueta: 'Ver detalle', etiquetaAccesible: `Ver el detalle de la clase ${clase.tipo}`, icono: 'ojo' },
]

function alSeleccionar(clase: Clase) {
  void router.push({ name: 'clase-detalle', params: { claseId: clase.id }, query: props.parametrosDetalle })
}
</script>

<template>
  <TablaFz titulo="Agenda de clases" ocultar-titulo :columnas="columnas" :filas="clases" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-tipo="{ fila }">
      <span class="tabla-clases__clase">
        <span class="tabla-clases__nombre">{{ fila.tipo }}</span>
        <MarcaDeClase v-if="marcaDe(fila.id)" :marca="marcaDe(fila.id)!" />
      </span>
    </template>
    <template #celda-horario="{ fila }">{{ formatearHorario(fila) }}</template>
    <template #celda-sede="{ fila }">{{ nombreSede(fila.sedeId) }}</template>
    <template #celda-cupos="{ fila }">{{ fila.cupoDisponible }} de {{ fila.capacidad }}</template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="estadoDeClase(fila).variante">{{ estadoDeClase(fila).etiqueta }}</InsigniaFz>
    </template>
    <template #celda-acciones="{ fila }">
      <AccionesFilaFz
        :etiqueta="`Acciones de la clase ${fila.tipo}`"
        :identificador="`acciones-clase-${fila.id}`"
        :acciones="accionesDe(fila)"
        :maximo="MAXIMO_DE_ACCIONES"
        @seleccionar="alSeleccionar(fila)"
      />
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

.tabla-clases__nombre {
  font-weight: var(--fz-peso-enfasis);
}
</style>
