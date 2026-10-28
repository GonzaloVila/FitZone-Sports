<script setup lang="ts">
import { useRouter } from 'vue-router'
import { AccionesFilaFz, InsigniaFz, TablaFz, type AccionFilaFz, type ColumnaTabla } from '@/ui'
import { PARAMETROS_DESDE_MIS_CLASES } from '../direccion'
import { ETIQUETAS_ESTADO_RESERVA, VARIANTES_ESTADO_RESERVA, formatearHorario } from '../presentacion'
import { momentoDeClase } from '../reglas'
import type { FilaReserva } from '../tipos'

const props = defineProps<{
  titulo: string
  filas: FilaReserva[]
  nombreSede: (sedeId: number) => string
  ahora: number
  // Ofrece "Cancelar reserva" cuando la clase todavía no comenzó (solo en las próximas). "Ver detalle" siempre está.
  conAcciones?: boolean
  ocupada?: boolean
}>()

const emit = defineEmits<{
  (e: 'cancelar', fila: FilaReserva): void
}>()

const router = useRouter()

const columnas: ColumnaTabla[] = [
  { clave: 'clase', etiqueta: 'Clase', encabezadoFila: true },
  { clave: 'horario', etiqueta: 'Horario' },
  { clave: 'sede', etiqueta: 'Sede' },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
  { clave: 'acciones', etiqueta: 'Acciones', etiquetaOculta: true, ajustada: true, alineacion: 'fin' },
]

// "Ver detalle" y "Cancelar reserva": como mucho 2 acciones por fila, así que son íconos. El nombre es texto simple.
const MAXIMO_DE_ACCIONES = 2

const claveFila = (fila: FilaReserva) => fila.reserva.id
const nombreDe = (fila: FilaReserva) => fila.clase?.tipo ?? `Clase #${fila.reserva.claseId}`

function puedeCancelar(fila: FilaReserva): boolean {
  return Boolean(props.conAcciones) && fila.clase !== null && momentoDeClase(fila.clase, props.ahora) !== 'comenzada'
}

function accionesDe(fila: FilaReserva): AccionFilaFz[] {
  return [
    { clave: 'ver-detalle', etiqueta: 'Ver detalle', etiquetaAccesible: `Ver el detalle de la reserva de ${nombreDe(fila)}`, icono: 'ojo' },
    ...(puedeCancelar(fila)
      ? [
          {
            clave: 'cancelar',
            etiqueta: 'Cancelar reserva',
            etiquetaAccesible: `Cancelar la reserva de ${nombreDe(fila)}`,
            icono: 'cerrar' as const,
            peligro: true,
          },
        ]
      : []),
  ]
}

function alSeleccionar(fila: FilaReserva, clave: string) {
  if (clave === 'ver-detalle') {
    void router.push({ name: 'clase-detalle', params: { claseId: fila.reserva.claseId }, query: PARAMETROS_DESDE_MIS_CLASES })
  } else if (clave === 'cancelar') {
    emit('cancelar', fila)
  }
}
</script>

<template>
  <TablaFz :titulo="titulo" ocultar-titulo :columnas="columnas" :filas="filas" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-clase="{ fila }">
      <span class="tabla-reservas__nombre">{{ nombreDe(fila) }}</span>
    </template>
    <template #celda-horario="{ fila }">
      <template v-if="fila.clase">{{ formatearHorario(fila.clase) }}</template>
      <span v-else class="tabla-reservas__tenue">No disponible</span>
    </template>
    <template #celda-sede="{ fila }">
      <template v-if="fila.clase">{{ nombreSede(fila.clase.sedeId) }}</template>
      <span v-else class="tabla-reservas__tenue">—</span>
    </template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="VARIANTES_ESTADO_RESERVA[fila.reserva.estado]">
        {{ ETIQUETAS_ESTADO_RESERVA[fila.reserva.estado] }}
      </InsigniaFz>
    </template>
    <template #celda-acciones="{ fila }">
      <AccionesFilaFz
        :etiqueta="`Acciones de la reserva de ${nombreDe(fila)}`"
        :identificador="`acciones-reserva-clase-${fila.reserva.id}`"
        :acciones="accionesDe(fila)"
        :maximo="MAXIMO_DE_ACCIONES"
        @seleccionar="(clave) => alSeleccionar(fila, clave)"
      />
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-reservas__nombre {
  font-weight: var(--fz-peso-enfasis);
}

.tabla-reservas__tenue {
  color: var(--fz-color-texto-suave);
}
</style>
