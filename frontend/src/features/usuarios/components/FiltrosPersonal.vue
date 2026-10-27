<script setup lang="ts">
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { BotonFz, CampoTextoFz, IconoFz, SelectFz } from '@/ui'

defineProps<{
  sedes: Sede[]
  cargandoSedes?: boolean
  // Si hay algún filtro aplicado: muestra "Limpiar". Quién limpia es el padre (evento `limpiar`).
  hayFiltrosActivos: boolean
}>()

const emit = defineEmits<{
  limpiar: []
}>()

const nombre = defineModel<string>('nombre', { required: true })
// '' = todas las sedes.
const sede = defineModel<string>('sede', { required: true })
</script>

<template>
  <div class="filtros" role="search" aria-label="Filtros de recepcionistas">
    <div class="filtros__busqueda">
      <CampoTextoFz
        v-model="nombre"
        tipo="search"
        icono="buscar"
        name="nombre"
        autocomplete="off"
        placeholder="Buscar por nombre…"
        aria-label="Buscar recepcionista por nombre"
      />
    </div>

    <div class="filtros__select">
      <SelectFz v-model="sede" name="sede" aria-label="Sede de trabajo" :disabled="cargandoSedes">
        <option value="">Todas las sedes</option>
        <option v-for="opcion in sedes" :key="opcion.id" :value="String(opcion.id)">{{ opcion.nombre }}</option>
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

/* El select mide lo que su contenido. */
.filtros__select {
  flex: none;
  width: max-content;
  max-width: 100%;
}
</style>
