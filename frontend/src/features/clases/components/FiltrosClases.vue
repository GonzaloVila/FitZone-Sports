<script setup lang="ts">
import { CampoFormularioFz, SelectFz } from '@/ui'
import type { Sede } from '@/features/sedes/services/servicioSedes'

defineProps<{
  sedes: Sede[]
  totalResultados: number
}>()

const tipo = defineModel<string>('tipo', { required: true })
const sede = defineModel<string>('sede', { required: true })
</script>

<template>
  <form class="filtros" role="search" aria-label="Filtros de la agenda" @submit.prevent>
    <div class="filtros__campo">
      <CampoFormularioFz
        v-model="tipo"
        etiqueta="Disciplina"
        tipo="search"
        name="tipo"
        placeholder="Ej: Spinning, Yoga"
        autocomplete="off"
      />
    </div>
    <div class="filtros__campo">
      <label for="filtro-sede" class="filtros__etiqueta">Sede</label>
      <SelectFz id="filtro-sede" v-model="sede" name="sede">
        <option value="">Todas las sedes</option>
        <option v-for="opcion in sedes" :key="opcion.id" :value="String(opcion.id)">{{ opcion.nombre }}</option>
      </SelectFz>
    </div>
    <p class="filtros__resultados" role="status">
      {{ totalResultados }} {{ totalResultados === 1 ? 'clase' : 'clases' }}
    </p>
  </form>
</template>

<style scoped>
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--fz-espaciado-base);
  padding: var(--fz-espaciado-base);
  background: var(--fz-color-superficie);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  box-shadow: var(--fz-sombra-tarjeta);
}

.filtros__campo {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1 1 14rem;
}

.filtros__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: var(--fz-peso-enfasis);
  color: var(--fz-color-texto);
}

.filtros__resultados {
  margin: 0;
  margin-left: auto;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}
</style>
