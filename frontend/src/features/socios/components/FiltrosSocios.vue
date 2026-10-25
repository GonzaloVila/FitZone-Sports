<script setup lang="ts">
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { BotonFz, CampoTextoFz, IconoFz, SelectFz } from '@/ui'
import { ESTADOS, ETIQUETAS_ESTADO, ETIQUETAS_PLAN, PLANES } from '../presentacion'

defineProps<{
  sedes: Sede[]
  // Si hay algún filtro aplicado: muestra "Limpiar". Quién limpia es el padre (evento `limpiar`).
  hayFiltrosActivos: boolean
}>()

const emit = defineEmits<{
  limpiar: []
}>()

const nombre = defineModel<string>('nombre', { required: true })
const estado = defineModel<string>('estado', { required: true })
const plan = defineModel<string>('plan', { required: true })
const sede = defineModel<string>('sede', { required: true })
</script>

<template>
  <div class="filtros" role="search" aria-label="Filtros de socios">
    <div class="filtros__busqueda">
      <CampoTextoFz
        v-model="nombre"
        tipo="search"
        icono="buscar"
        name="nombre"
        autocomplete="off"
        placeholder="Buscar por nombre…"
        aria-label="Buscar socio por nombre"
      />
    </div>

    <div class="filtros__select">
      <SelectFz v-model="estado" name="estado" aria-label="Estado de la membresía">
        <option value="">Todos los estados</option>
        <option v-for="valor in ESTADOS" :key="valor" :value="valor">{{ ETIQUETAS_ESTADO[valor] }}</option>
      </SelectFz>
    </div>

    <div class="filtros__select">
      <SelectFz v-model="plan" name="plan" aria-label="Plan">
        <option value="">Todos los planes</option>
        <option v-for="valor in PLANES" :key="valor" :value="valor">{{ ETIQUETAS_PLAN[valor] }}</option>
      </SelectFz>
    </div>

    <div class="filtros__select">
      <SelectFz v-model="sede" name="sede" aria-label="Sede de origen">
        <option value="">Todas las sedes</option>
        <option v-for="s in sedes" :key="s.id" :value="String(s.id)">{{ s.nombre }}</option>
      </SelectFz>
    </div>

    <BotonFz v-if="hayFiltrosActivos" variante="fantasma" @click="emit('limpiar')">
      <IconoFz nombre="cerrar" tamano="sm" />
      Limpiar
    </BotonFz>
  </div>
</template>

<style scoped>
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

/* El buscador se estira; en ancho chico pasa solo a otra línea. */
.filtros__busqueda {
  flex: 1 1 calc(10 * var(--fz-espaciado-amplio));
  min-width: 0;
}

/* Los selects miden lo que su contenido. */
.filtros__select {
  flex: none;
  width: max-content;
  max-width: 100%;
}
</style>
