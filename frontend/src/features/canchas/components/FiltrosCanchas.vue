<script setup lang="ts">
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { SelectFz } from '@/ui'
import { ESTADOS_CANCHA, ETIQUETA_ESTADO_CANCHA } from '../presentacion'

defineProps<{
  sedes: Sede[]
  cargandoSedes?: boolean
}>()

const sede = defineModel<string>('sede', { required: true })
const estado = defineModel<string>('estado', { required: true })
</script>

<template>
  <div class="filtros" role="search" aria-label="Filtros de canchas">
    <div class="filtros__select">
      <SelectFz v-model="sede" name="sede" aria-label="Sede" :disabled="cargandoSedes">
        <option value="" disabled>{{ cargandoSedes ? 'Cargando sedes…' : 'Elegí una sede' }}</option>
        <option v-for="opcion in sedes" :key="opcion.id" :value="String(opcion.id)">{{ opcion.nombre }}</option>
      </SelectFz>
    </div>

    <div class="filtros__select">
      <SelectFz v-model="estado" name="estado" aria-label="Estado de la cancha">
        <option value="">Todos los estados</option>
        <option v-for="valor in ESTADOS_CANCHA" :key="valor" :value="valor">{{ ETIQUETA_ESTADO_CANCHA[valor] }}</option>
      </SelectFz>
    </div>
  </div>
</template>

<style scoped>
.filtros {
  display: flex;
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
</style>
