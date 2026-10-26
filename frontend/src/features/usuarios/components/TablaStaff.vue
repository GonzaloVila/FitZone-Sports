<script setup lang="ts">
import { InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import type { Usuario } from '../services/servicioUsuarios'

defineProps<{
  filas: Usuario[]
  nombreSede: (sedeId: number) => string
  ocupada?: boolean
}>()

const columnas: ColumnaTabla[] = [
  { clave: 'nombre', etiqueta: 'Nombre y apellido', encabezadoFila: true },
  { clave: 'dni', etiqueta: 'DNI', ajustada: true },
  { clave: 'email', etiqueta: 'Correo' },
  { clave: 'sede', etiqueta: 'Sede de trabajo', ajustada: true },
]

const claveFila = (fila: Usuario) => fila.id
</script>

<template>
  <TablaFz
    titulo="Listado de recepcionistas"
    ocultar-titulo
    :columnas="columnas"
    :filas="filas"
    :clave-fila="claveFila"
    :ocupada="ocupada"
  >
    <template #celda-nombre="{ fila }">
      <span class="tabla-staff__nombre">{{ (fila as Usuario).nombre }}</span>
    </template>
    <template #celda-dni="{ fila }">
      <span class="tabla-staff__dato">{{ (fila as Usuario).dni }}</span>
    </template>
    <template #celda-email="{ fila }">
      <span class="tabla-staff__dato">{{ (fila as Usuario).email }}</span>
    </template>
    <template #celda-sede="{ fila }">
      <InsigniaFz v-if="(fila as Usuario).sedeId" variante="neutra">
        {{ nombreSede((fila as Usuario).sedeId as number) }}
      </InsigniaFz>
      <InsigniaFz v-else variante="advertencia">Sin sede</InsigniaFz>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-staff__nombre {
  font-weight: var(--fz-peso-enfasis);
}

.tabla-staff__dato {
  color: var(--fz-color-texto-suave);
}
</style>
