<script setup lang="ts">
import { CampoFormularioFz, CampoTextoFz, SelectFz } from '@/ui'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import type { FiltrosHistorialAccesos } from '../composables/useHistorialAccesos'

const props = defineProps<{
  filtros: FiltrosHistorialAccesos
  sedes: Sede[]
  esGerente: boolean
}>()

const emit = defineEmits<{
  (e: 'update:filtros', valor: FiltrosHistorialAccesos): void
}>()
</script>

<template>
  <div class="filtros-historial">
    <CampoFormularioFz
      v-if="esGerente"
      etiqueta="Sede"
      nombre="filtroSede"
      class="filtros-historial__campo"
    >
      <SelectFz
        id="filtroSede"
        :model-value="filtros.sedeId ? String(filtros.sedeId) : ''"
        @update:model-value="(val) => (filtros.sedeId = val ? Number(val) : '')"
      >
        <option value="">Todas las sedes</option>
        <option v-for="s in sedes" :key="s.id" :value="String(s.id)">
          {{ s.nombre }}
        </option>
      </SelectFz>
    </CampoFormularioFz>

    <CampoFormularioFz
      etiqueta="Fecha"
      nombre="filtroFecha"
      class="filtros-historial__campo"
    >
      <CampoTextoFz
        id="filtroFecha"
        v-model="filtros.fecha"
        type="date"
      />
    </CampoFormularioFz>

    <CampoFormularioFz
      etiqueta="Buscar por nombre"
      nombre="filtroNombre"
      class="filtros-historial__campo"
    >
      <CampoTextoFz
        id="filtroNombre"
        v-model="filtros.nombre"
        placeholder="Nombre o apellido"
      />
    </CampoFormularioFz>

    <CampoFormularioFz
      etiqueta="ID de Socio"
      nombre="filtroSocio"
      class="filtros-historial__campo"
    >
      <CampoTextoFz
        id="filtroSocio"
        :model-value="filtros.socioId ? String(filtros.socioId) : ''"
        type="number"
        min="1"
        placeholder="Ej: 1"
        @update:model-value="(val) => (filtros.socioId = val ? Number(val) : '')"
      />
    </CampoFormularioFz>
  </div>
</template>

<style scoped>
.filtros-historial {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--fz-espaciado-base);
  background: var(--fz-color-fondo);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-control);
  padding: var(--fz-espaciado-base);
}

.filtros-historial__campo {
  margin-bottom: 0;
}
</style>
