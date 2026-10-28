<script setup lang="ts">
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { BotonFz, IconoFz, SelectFz } from '@/ui'
import { ESTADOS_CANCHA, ETIQUETA_ESTADO_CANCHA, ETIQUETA_TIPO_CANCHA, TIPOS_CANCHA } from '../presentacion'

defineProps<{
  sedes: Sede[]
  cargandoSedes?: boolean
  // El RECEPCION trabaja en la sede de su token: no hay selector de sede.
  sedeFija?: boolean
  // Si hay algún filtro aplicado: muestra "Limpiar". Quién limpia es el padre (evento `limpiar`).
  hayFiltrosActivos: boolean
}>()

const emit = defineEmits<{
  limpiar: []
}>()

// Deporte (el `tipo` de la cancha); '' = todos los deportes.
const tipo = defineModel<string>('tipo', { required: true })
const sede = defineModel<string>('sede', { required: true })
const estado = defineModel<string>('estado', { required: true })
</script>

<template>
  <!-- Una sola fila: a la izquierda los filtros; a la derecha, la acción principal de la pantalla (slot `acciones`, por
       ejemplo "Nueva cancha"). En ancho chico la fila se apila sin cambiar el orden. -->
  <div class="barra">
    <div class="filtros" role="search" aria-label="Filtros de canchas">
      <div class="filtros__select">
        <SelectFz v-model="tipo" name="tipo" aria-label="Deporte">
          <option value="">Todos los deportes</option>
          <option v-for="valor in TIPOS_CANCHA" :key="valor" :value="valor">{{ ETIQUETA_TIPO_CANCHA[valor] }}</option>
        </SelectFz>
      </div>

      <div v-if="!sedeFija" class="filtros__select">
        <SelectFz v-model="sede" name="sede" aria-label="Sede" :disabled="cargandoSedes">
          <option value="">Todas las sedes</option>
          <option v-for="opcion in sedes" :key="opcion.id" :value="String(opcion.id)">{{ opcion.nombre }}</option>
        </SelectFz>
      </div>

      <div class="filtros__select">
        <SelectFz v-model="estado" name="estado" aria-label="Estado de la cancha">
          <option value="">Todos los estados</option>
          <option v-for="valor in ESTADOS_CANCHA" :key="valor" :value="valor">{{ ETIQUETA_ESTADO_CANCHA[valor] }}</option>
        </SelectFz>
      </div>

      <BotonFz v-if="hayFiltrosActivos" variante="fantasma" @click="emit('limpiar')">
        <IconoFz nombre="cerrar" tamano="sm" />
        Limpiar
      </BotonFz>
    </div>

    <div v-if="$slots.acciones" class="barra__acciones">
      <slot name="acciones" />
    </div>
  </div>
</template>

<style scoped>
.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-compacto);
}

.filtros {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

/* Los selects miden lo que su contenido. */
.filtros__select {
  flex: none;
  width: max-content;
  max-width: 100%;
}

/* La acción queda pegada al borde derecho de la misma fila. */
.barra__acciones {
  flex: none;
  margin-inline-start: auto;
}
</style>
