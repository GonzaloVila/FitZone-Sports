<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { BotonFz, InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
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
  { clave: 'posicion', etiqueta: 'Posición' },
  { clave: 'estado', etiqueta: 'Estado' },
  { clave: 'acciones', etiqueta: 'Acciones' },
]

const claveFila = (fila: FilaEspera) => fila.espera.id
</script>

<template>
  <TablaFz titulo="Mis listas de espera" ocultar-titulo :columnas="columnas" :filas="filas" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-clase="{ fila }">
      <RouterLink :to="{ name: 'clase-detalle', params: { claseId: (fila as FilaEspera).espera.claseId } }" class="tabla-esperas__enlace">
        {{ (fila as FilaEspera).clase?.tipo ?? `Clase #${(fila as FilaEspera).espera.claseId}` }}
      </RouterLink>
    </template>
    <template #celda-horario="{ fila }">
      <template v-if="(fila as FilaEspera).clase">{{ formatearHorario((fila as FilaEspera).clase!) }}</template>
      <span v-else class="tabla-esperas__tenue">No disponible</span>
    </template>
    <template #celda-posicion="{ fila }">
      <template v-if="(fila as FilaEspera).posicion !== null">Lugar {{ (fila as FilaEspera).posicion }}</template>
      <span v-else class="tabla-esperas__tenue">—</span>
    </template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="VARIANTES_ESTADO_ESPERA[(fila as FilaEspera).espera.estado]">
        {{ ETIQUETAS_ESTADO_ESPERA[(fila as FilaEspera).espera.estado] }}
      </InsigniaFz>
    </template>
    <template #celda-acciones="{ fila }">
      <div class="tabla-esperas__acciones">
        <BotonFz
          v-if="(fila as FilaEspera).espera.estado === 'NOTIFICADO'"
          variante="primario"
          tamano="sm"
          :disabled="ocupada"
          @click="$emit('confirmar', fila as FilaEspera)"
        >
          Confirmar cupo
        </BotonFz>
        <BotonFz variante="secundario" tamano="sm" :disabled="ocupada" @click="$emit('salir', fila as FilaEspera)">
          Salir
        </BotonFz>
      </div>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-esperas__enlace {
  color: var(--fz-color-primario);
  font-weight: var(--fz-peso-enfasis);
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
  gap: var(--fz-espaciado-compacto);
}
</style>
