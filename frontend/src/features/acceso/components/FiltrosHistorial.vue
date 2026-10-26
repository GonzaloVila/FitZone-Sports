<script setup lang="ts">
import { computed } from 'vue'
import { BotonFz, CampoTextoFz, IconoFz, SelectFz } from '@/ui'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import type { FiltrosHistorialAccesos } from '../composables/useHistorialAccesos'

const props = defineProps<{
  filtros: FiltrosHistorialAccesos
  sedes: Sede[]
  esGerente: boolean
}>()

const emit = defineEmits<{
  (e: 'update:filtros', valor: FiltrosHistorialAccesos): void
  (e: 'limpiar'): void
}>()

// La sede solo es un filtro para el GERENTE; el RECEPCION trabaja con la suya.
const hayFiltrosActivos = computed(() =>
  Boolean(props.filtros.fecha || props.filtros.nombre.trim() || props.filtros.socioId || (props.esGerente && props.filtros.sedeId)),
)
</script>

<template>
  <div class="filtros" role="search" aria-label="Filtros del historial">
    <div class="filtros__busqueda">
      <CampoTextoFz
        v-model="filtros.nombre"
        tipo="search"
        icono="buscar"
        name="nombre"
        autocomplete="off"
        placeholder="Buscar por nombre…"
        aria-label="Buscar por nombre"
      />
    </div>

    <div v-if="esGerente" class="filtros__ajustado">
      <SelectFz
        name="sede"
        aria-label="Sede"
        :model-value="filtros.sedeId ? String(filtros.sedeId) : ''"
        @update:model-value="(val) => (filtros.sedeId = val ? Number(val) : '')"
      >
        <option value="">Todas las sedes</option>
        <option v-for="s in sedes" :key="s.id" :value="String(s.id)">{{ s.nombre }}</option>
      </SelectFz>
    </div>

    <!-- La fecha mantiene su etiqueta visible: un campo de fecha vacío no dice por sí solo para qué sirve. -->
    <div class="filtros__ajustado filtros__fecha">
      <label for="filtro-fecha" class="filtros__etiqueta">Fecha</label>
      <CampoTextoFz id="filtro-fecha" v-model="filtros.fecha" tipo="date" name="fecha" />
    </div>

    <div class="filtros__ajustado filtros__socio">
      <CampoTextoFz
        :model-value="filtros.socioId ? String(filtros.socioId) : ''"
        tipo="number"
        name="socioId"
        min="1"
        placeholder="ID de socio"
        aria-label="ID de socio"
        @update:model-value="(val) => (filtros.socioId = val ? Number(val) : '')"
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

.filtros__ajustado {
  flex: none;
  width: max-content;
  max-width: 100%;
}

.filtros__fecha {
  display: flex;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.filtros__etiqueta {
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.filtros__socio {
  width: calc(8 * var(--fz-espaciado-base));
}
</style>
