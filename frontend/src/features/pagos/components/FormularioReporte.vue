<script setup lang="ts">
import { AvisoFz, BotonFz, CampoTextoFz } from '@/ui'

defineProps<{ errorFechas: string | null; descargando: boolean; error: string | null }>()
const emit = defineEmits<{ descargar: [] }>()

const desde = defineModel<string>('desde', { required: true })
const hasta = defineModel<string>('hasta', { required: true })
</script>

<template>
  <form class="formulario-reporte" @submit.prevent="emit('descargar')">
    <div class="formulario-reporte__campos">
      <label class="formulario-reporte__campo">
        <span class="formulario-reporte__etiqueta">Desde</span>
        <CampoTextoFz v-model="desde" tipo="date" />
      </label>
      <label class="formulario-reporte__campo">
        <span class="formulario-reporte__etiqueta">Hasta</span>
        <CampoTextoFz v-model="hasta" tipo="date" />
      </label>
    </div>
    <p class="formulario-reporte__nota">
      El rango incluye desde y hasta. Si dejás las dos fechas vacías, el reporte incluye todo el histórico.
    </p>
    <AvisoFz v-if="errorFechas" variante="advertencia">{{ errorFechas }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <div class="formulario-reporte__acciones">
      <BotonFz tipo="submit" :cargando="descargando" :disabled="descargando || Boolean(errorFechas)">
        Descargar PDF
      </BotonFz>
    </div>
  </form>
</template>

<style scoped>
.formulario-reporte {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  padding: var(--fz-espaciado-base);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  background: var(--fz-color-superficie);
}

.formulario-reporte__campos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--fz-espaciado-base);
}

.formulario-reporte__campo {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.formulario-reporte__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: 600;
  color: var(--fz-color-texto);
}

.formulario-reporte__nota {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}

.formulario-reporte__acciones {
  display: flex;
  justify-content: flex-end;
}
</style>
