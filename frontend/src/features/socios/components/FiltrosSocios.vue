<script setup lang="ts">
import { computed, useId } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { BotonFz, CampoTextoFz, SelectFz } from '@/ui'
import { ESTADOS, ETIQUETAS_ESTADO, ETIQUETAS_PLAN, PLANES } from '../presentacion'

const props = defineProps<{
  sedes: Sede[]
  totalResultados?: number
}>()

const emit = defineEmits<{
  (e: 'exportar'): void
  (e: 'limpiar'): void
}>()

const nombre = defineModel<string>('nombre', { required: true })
const estado = defineModel<string>('estado', { required: true })
const plan = defineModel<string>('plan', { required: true })
const sede = defineModel<string>('sede', { required: true })

const idEstado = useId()
const idPlan = useId()
const idSede = useId()

const hayFiltrosActivos = computed(() => {
  return Boolean(nombre.value.trim() || estado.value || plan.value || sede.value)
})

function limpiarFiltros() {
  nombre.value = ''
  estado.value = ''
  plan.value = ''
  sede.value = ''
  emit('limpiar')
}
</script>

<template>
  <div class="toolbar-socios">
    <!-- Input con búsqueda y lupa -->
    <div class="toolbar-socios__busqueda">
      <span class="toolbar-socios__icono-lupa" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <CampoTextoFz
        v-model="nombre"
        tipo="search"
        tamano="sm"
        placeholder="Buscar por nombre, email o DNI…"
        class="toolbar-socios__input"
        aria-label="Buscar socio"
      />
    </div>

    <!-- Selectores compactos en línea -->
    <div class="toolbar-socios__filtros">
      <div class="toolbar-socios__filtro-item">
        <label :for="idEstado" class="toolbar-socios__label">Estado:</label>
        <SelectFz :id="idEstado" v-model="estado" name="estado" tamano="sm" class="toolbar-socios__select">
          <option value="">Todos</option>
          <option v-for="valor in ESTADOS" :key="valor" :value="valor">
            {{ ETIQUETAS_ESTADO[valor] }}
          </option>
        </SelectFz>
      </div>

      <div class="toolbar-socios__filtro-item">
        <label :for="idPlan" class="toolbar-socios__label">Plan:</label>
        <SelectFz :id="idPlan" v-model="plan" name="plan" tamano="sm" class="toolbar-socios__select">
          <option value="">Todos</option>
          <option v-for="valor in PLANES" :key="valor" :value="valor">
            {{ ETIQUETAS_PLAN[valor] }}
          </option>
        </SelectFz>
      </div>

      <div class="toolbar-socios__filtro-item">
        <label :for="idSede" class="toolbar-socios__label">Sede:</label>
        <SelectFz :id="idSede" v-model="sede" name="sede" tamano="sm" class="toolbar-socios__select">
          <option value="">Todas</option>
          <option v-for="s in sedes" :key="s.id" :value="String(s.id)">
            {{ s.nombre }}
          </option>
        </SelectFz>
      </div>
    </div>

    <!-- Acciones secundarias a la derecha -->
    <div class="toolbar-socios__acciones">
      <BotonFz
        v-if="hayFiltrosActivos"
        variante="fantasma"
        tamano="sm"
        @click="limpiarFiltros"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.25rem;">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        Limpiar
      </BotonFz>

      <BotonFz
        variante="secundario"
        tamano="sm"
        title="Exportar socios a CSV"
        @click="emit('exportar')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.25rem;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Exportar CSV
      </BotonFz>
    </div>
  </div>
</template>

<style scoped>
.toolbar-socios {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: var(--fz-color-superficie);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  padding: 0.75rem 1rem;
  box-shadow: var(--fz-sombra-tarjeta);
}

.toolbar-socios__busqueda {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 18rem;
  flex: 1 1 18rem;
}

.toolbar-socios__icono-lupa {
  position: absolute;
  left: 0.75rem;
  color: var(--fz-color-texto-suave);
  pointer-events: none;
  display: flex;
  align-items: center;
  z-index: 1;
}

:deep(.toolbar-socios__input) {
  padding-left: 2.25rem !important;
  width: 100%;
}

.toolbar-socios__filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.toolbar-socios__filtro-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.toolbar-socios__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--fz-color-texto-suave);
  white-space: nowrap;
}

.toolbar-socios__select {
  min-width: 7.5rem;
}

.toolbar-socios__acciones {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}
</style>
