<script setup lang="ts">
import { InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { ETIQUETAS_ESTADO, ETIQUETAS_PLAN, VARIANTES_ESTADO, formatearFecha } from '../presentacion'
import type { FilaSocio } from '../tipos'

defineProps<{
  filas: FilaSocio[]
  nombreSede: (sedeId: number) => string
  ocupada?: boolean
}>()

const columnas: ColumnaTabla[] = [
  { clave: 'nombre', etiqueta: 'Nombre', encabezadoFila: true },
  { clave: 'email', etiqueta: 'Email' },
  { clave: 'sede', etiqueta: 'Sede de origen' },
  { clave: 'alta', etiqueta: 'Fecha de alta' },
  { clave: 'plan', etiqueta: 'Plan' },
  { clave: 'estado', etiqueta: 'Estado' },
]

const claveFila = (fila: FilaSocio) => fila.socio.id
</script>

<template>
  <TablaFz titulo="Listado de socios" ocultar-titulo :columnas="columnas" :filas="filas" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-nombre="{ fila }">{{ fila.socio.nombre }}</template>
    <template #celda-email="{ fila }">{{ fila.socio.email }}</template>
    <template #celda-sede="{ fila }">{{ nombreSede(fila.socio.sedeOrigenId) }}</template>
    <template #celda-alta="{ fila }">{{ formatearFecha(fila.socio.fechaAlta) }}</template>

    <template #celda-plan="{ fila }">
      <InsigniaFz v-if="fila.membresia.situacion === 'disponible'">
        {{ ETIQUETAS_PLAN[fila.membresia.membresia.plan] }}
      </InsigniaFz>
      <span v-else class="tabla-socios__tenue">
        {{ fila.membresia.situacion === 'cargando' ? 'Cargando…' : 'No disponible' }}
      </span>
    </template>

    <template #celda-estado="{ fila }">
      <InsigniaFz
        v-if="fila.membresia.situacion === 'disponible'"
        :variante="VARIANTES_ESTADO[fila.membresia.membresia.estado]"
      >
        {{ ETIQUETAS_ESTADO[fila.membresia.membresia.estado] }}
      </InsigniaFz>
      <span v-else class="tabla-socios__tenue">
        {{ fila.membresia.situacion === 'cargando' ? 'Cargando…' : 'No disponible' }}
      </span>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-socios__tenue {
  color: var(--fz-color-texto-suave);
}
</style>
