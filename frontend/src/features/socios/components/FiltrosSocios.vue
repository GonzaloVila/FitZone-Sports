<script setup lang="ts">
import { useId } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { CampoFormularioFz, SelectFz } from '@/ui'
import { ESTADOS, ETIQUETAS_ESTADO, ETIQUETAS_PLAN, PLANES } from '../presentacion'

defineProps<{
  sedes: Sede[]
}>()

// '' = todos.
const nombre = defineModel<string>('nombre', { required: true })
const estado = defineModel<string>('estado', { required: true })
const plan = defineModel<string>('plan', { required: true })
const sede = defineModel<string>('sede', { required: true })

const idEstado = useId()
const idPlan = useId()
const idSede = useId()
</script>

<template>
  <form class="filtros" role="search" aria-label="Filtros de socios" @submit.prevent>
    <CampoFormularioFz
      v-model="nombre"
      etiqueta="Buscar por nombre"
      tipo="search"
      name="nombre"
      autocomplete="off"
    />

    <div class="filtros__campo">
      <label :for="idEstado" class="filtros__etiqueta">Estado</label>
      <SelectFz :id="idEstado" v-model="estado" name="estado">
        <option value="">Todos</option>
        <option v-for="valor in ESTADOS" :key="valor" :value="valor">{{ ETIQUETAS_ESTADO[valor] }}</option>
      </SelectFz>
    </div>

    <div class="filtros__campo">
      <label :for="idPlan" class="filtros__etiqueta">Plan</label>
      <SelectFz :id="idPlan" v-model="plan" name="plan">
        <option value="">Todos</option>
        <option v-for="valor in PLANES" :key="valor" :value="valor">{{ ETIQUETAS_PLAN[valor] }}</option>
      </SelectFz>
    </div>

    <div class="filtros__campo">
      <label :for="idSede" class="filtros__etiqueta">Sede</label>
      <SelectFz :id="idSede" v-model="sede" name="sede">
        <option value="">Todas</option>
        <option v-for="opcion in sedes" :key="opcion.id" :value="String(opcion.id)">{{ opcion.nombre }}</option>
      </SelectFz>
    </div>
  </form>
</template>

<style scoped>
.filtros {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--fz-espaciado-base);
}

.filtros__campo {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.filtros__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: var(--fz-peso-enfasis);
  color: var(--fz-color-texto);
}
</style>
