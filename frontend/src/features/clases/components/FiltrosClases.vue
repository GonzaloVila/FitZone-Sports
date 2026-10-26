<script setup lang="ts">
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { CampoTextoFz, SelectFz } from '@/ui'

defineProps<{
  sedes: Sede[]
}>()

const tipo = defineModel<string>('tipo', { required: true })
const sede = defineModel<string>('sede', { required: true })
</script>

<template>
  <div class="filtros" role="search" aria-label="Filtros de la agenda">
    <div class="filtros__busqueda">
      <CampoTextoFz
        v-model="tipo"
        tipo="search"
        icono="buscar"
        name="tipo"
        autocomplete="off"
        placeholder="Buscar por disciplina…"
        aria-label="Buscar por disciplina"
      />
    </div>

    <div class="filtros__select">
      <SelectFz v-model="sede" name="sede" aria-label="Sede">
        <option value="">Todas las sedes</option>
        <option v-for="opcion in sedes" :key="opcion.id" :value="String(opcion.id)">{{ opcion.nombre }}</option>
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
