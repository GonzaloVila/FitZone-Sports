<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { BotonFz, InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { PARAMETROS_DESDE_MIS_CLASES } from '../direccion'
import { ETIQUETAS_ESTADO_ESPERA, VARIANTES_ESTADO_ESPERA, formatearHorario } from '../presentacion'
import type { FilaEspera } from '../tipos'

defineProps<{
  filas: FilaEspera[]
  ocupada?: boolean
}>()

defineEmits<{
  (e: 'confirmar', fila: FilaEspera): void
  (e: 'salir', fila: FilaEspera): void
}>()

const columnas: ColumnaTabla[] = [
  { clave: 'clase', etiqueta: 'Clase', encabezadoFila: true },
  { clave: 'horario', etiqueta: 'Horario' },
  { clave: 'posicion', etiqueta: 'Posición', ajustada: true },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
  { clave: 'acciones', etiqueta: 'Acciones', ajustada: true, alineacion: 'fin' },
]

const claveFila = (fila: FilaEspera) => fila.espera.id
</script>

<template>
  <TablaFz titulo="Mis listas de espera" ocultar-titulo :columnas="columnas" :filas="filas" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-clase="{ fila }">
      <RouterLink
        :to="{ name: 'clase-detalle', params: { claseId: fila.espera.claseId }, query: PARAMETROS_DESDE_MIS_CLASES }"
        class="tabla-esperas__enlace"
      >
        {{ fila.clase?.tipo ?? `Clase #${fila.espera.claseId}` }}
      </RouterLink>
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
      <div class="tabla-esperas__acciones">
        <BotonFz v-if="fila.espera.estado === 'NOTIFICADO'" variante="primario" tamano="sm" :disabled="ocupada" @click="$emit('confirmar', fila)">
          Confirmar cupo
        </BotonFz>
        <BotonFz variante="secundario" tamano="sm" :disabled="ocupada" @click="$emit('salir', fila)">Salir</BotonFz>
      </div>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-esperas__enlace {
  color: var(--fz-color-texto);
  font-weight: var(--fz-peso-enfasis);
  text-decoration: none;
}

.tabla-esperas__enlace:hover {
  text-decoration: underline;
}

.tabla-esperas__enlace:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}

.tabla-esperas__tenue {
  color: var(--fz-color-texto-suave);
}

.tabla-esperas__acciones {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--fz-espaciado-compacto);
}
</style>
