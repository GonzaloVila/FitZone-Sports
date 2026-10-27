<script setup lang="ts">
import { BotonFz, CampoTextoFz, IconoFz } from '@/ui'

defineProps<{
  // Si hay algún filtro aplicado: muestra "Limpiar". Quién limpia es el padre (evento `limpiar`).
  hayFiltrosActivos: boolean
}>()

const emit = defineEmits<{
  limpiar: []
}>()

const nombre = defineModel<string>('nombre', { required: true })
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
</style>
