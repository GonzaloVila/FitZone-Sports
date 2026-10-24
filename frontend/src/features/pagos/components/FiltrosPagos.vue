<script setup lang="ts">
import { CampoTextoFz, SelectFz } from '@/ui'
import { ESTADOS_PAGO, ETIQUETA_ESTADO_PAGO, ETIQUETA_TIPO_CONCEPTO, TIPOS_CONCEPTO } from '../presentacion'

const estado = defineModel<string>('estado', { required: true })
const tipo = defineModel<string>('tipo', { required: true })
const desde = defineModel<string>('desde', { required: true })
const hasta = defineModel<string>('hasta', { required: true })
</script>

<template>
  <div class="filtros-pagos">
    <label class="filtros-pagos__campo">
      <span class="filtros-pagos__etiqueta">Estado</span>
      <SelectFz v-model="estado">
        <option value="">Aprobados (por defecto)</option>
        <option v-for="valor in ESTADOS_PAGO" :key="valor" :value="valor">
          {{ ETIQUETA_ESTADO_PAGO[valor] }}
        </option>
      </SelectFz>
    </label>
    <label class="filtros-pagos__campo">
      <span class="filtros-pagos__etiqueta">Concepto</span>
      <SelectFz v-model="tipo">
        <option value="">Todos los conceptos</option>
        <option v-for="valor in TIPOS_CONCEPTO" :key="valor" :value="valor">
          {{ ETIQUETA_TIPO_CONCEPTO[valor] }}
        </option>
      </SelectFz>
    </label>
    <label class="filtros-pagos__campo">
      <span class="filtros-pagos__etiqueta">Desde</span>
      <CampoTextoFz v-model="desde" tipo="date" />
    </label>
    <label class="filtros-pagos__campo">
      <span class="filtros-pagos__etiqueta">Hasta</span>
      <CampoTextoFz v-model="hasta" tipo="date" />
    </label>
  </div>
</template>

<style scoped>
.filtros-pagos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--fz-espaciado-base);
}

.filtros-pagos__campo {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.filtros-pagos__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: 600;
  color: var(--fz-color-texto);
}
</style>
