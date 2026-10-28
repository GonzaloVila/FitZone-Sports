<script setup lang="ts">
import { useRouter } from 'vue-router'
import { AccionesFilaFz, InsigniaFz, TablaFz, type AccionFilaFz, type ColumnaTabla } from '@/ui'
import { PARAMETROS_DESDE_MIS_CLASES } from '../direccion'
import { ETIQUETAS_ESTADO_ESPERA, VARIANTES_ESTADO_ESPERA, formatearHorario } from '../presentacion'
import type { FilaEspera } from '../tipos'

const props = defineProps<{
  filas: FilaEspera[]
  ocupada?: boolean
}>()

const emit = defineEmits<{
  (e: 'confirmar', fila: FilaEspera): void
  (e: 'salir', fila: FilaEspera): void
}>()

const router = useRouter()

const columnas: ColumnaTabla[] = [
  { clave: 'clase', etiqueta: 'Clase', encabezadoFila: true },
  { clave: 'horario', etiqueta: 'Horario' },
  { clave: 'posicion', etiqueta: 'Posición', ajustada: true },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
  { clave: 'acciones', etiqueta: 'Acciones', conDivisor: true, ajustada: true, alineacion: 'centro' },
]

// "Confirmar cupo" (solo si te avisaron), "Ver detalle" y "Salir de la lista": hasta 3 acciones posibles, así que van todas en
// un menú "···". El nombre de la clase es texto simple.
const MAXIMO_DE_ACCIONES = 3

const claveFila = (fila: FilaEspera) => fila.espera.id
const nombreDe = (fila: FilaEspera) => fila.clase?.tipo ?? `Clase #${fila.espera.claseId}`

function accionesDe(fila: FilaEspera): AccionFilaFz[] {
  const nombre = nombreDe(fila)
  return [
    ...(fila.espera.estado === 'NOTIFICADO'
      ? [
          {
            clave: 'confirmar',
            etiqueta: 'Confirmar cupo',
            etiquetaAccesible: `Confirmar el cupo de ${nombre}`,
            icono: 'tilde' as const,
            deshabilitada: props.ocupada,
          },
        ]
      : []),
    { clave: 'ver-detalle', etiqueta: 'Ver detalle', etiquetaAccesible: `Ver el detalle de ${nombre}`, icono: 'ojo' },
    {
      clave: 'salir',
      etiqueta: 'Salir de la lista',
      etiquetaAccesible: `Salir de la lista de espera de ${nombre}`,
      icono: 'cerrar',
      peligro: true,
      separada: true,
      deshabilitada: props.ocupada,
    },
  ]
}

function alSeleccionar(fila: FilaEspera, clave: string) {
  if (clave === 'confirmar') emit('confirmar', fila)
  else if (clave === 'salir') emit('salir', fila)
  else if (clave === 'ver-detalle') {
    void router.push({ name: 'clase-detalle', params: { claseId: fila.espera.claseId }, query: PARAMETROS_DESDE_MIS_CLASES })
  }
}
</script>

<template>
  <TablaFz titulo="Mis listas de espera" ocultar-titulo :columnas="columnas" :filas="filas" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-clase="{ fila }">
      <span class="tabla-esperas__nombre">{{ nombreDe(fila) }}</span>
    </template>
    <template #celda-horario="{ fila }">
      <template v-if="fila.clase">{{ formatearHorario(fila.clase) }}</template>
      <span v-else class="tabla-esperas__tenue">No disponible</span>
    </template>
    <template #celda-posicion="{ fila }">
      <template v-if="fila.posicion !== null">Lugar {{ fila.posicion }}</template>
      <span v-else class="tabla-esperas__tenue">—</span>
    </template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="VARIANTES_ESTADO_ESPERA[fila.espera.estado]">
        {{ ETIQUETAS_ESTADO_ESPERA[fila.espera.estado] }}
      </InsigniaFz>
    </template>
    <template #celda-acciones="{ fila }">
      <AccionesFilaFz
        :etiqueta="`Acciones de la lista de espera de ${nombreDe(fila)}`"
        :identificador="`acciones-espera-${fila.espera.id}`"
        :acciones="accionesDe(fila)"
        :maximo="MAXIMO_DE_ACCIONES"
        @seleccionar="(clave) => alSeleccionar(fila, clave)"
      />
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-esperas__nombre {
  font-weight: var(--fz-peso-enfasis);
}

.tabla-esperas__tenue {
  color: var(--fz-color-texto-suave);
}
</style>
