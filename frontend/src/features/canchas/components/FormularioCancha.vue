<script setup lang="ts">
import { AvisoFz, BotonFz, CampoFormularioFz, SelectFz } from '@/ui'
import { ETIQUETA_TIPO_CANCHA, TIPOS_CANCHA } from '../presentacion'

defineProps<{ guardando: boolean; error: string | null }>()
const emit = defineEmits<{ crear: [] }>()

const tipo = defineModel<string>('tipo', { required: true })
const costoPorHora = defineModel<string>('costoPorHora', { required: true })
</script>

<template>
  <form class="formulario" @submit.prevent="emit('crear')">
    <div class="formulario__campos">
      <label class="formulario__campo">
        <span class="formulario__etiqueta">Deporte</span>
        <SelectFz v-model="tipo">
          <option v-for="valor in TIPOS_CANCHA" :key="valor" :value="valor">
            {{ ETIQUETA_TIPO_CANCHA[valor] }}
          </option>
        </SelectFz>
      </label>
      <CampoFormularioFz
        v-model="costoPorHora"
        etiqueta="Costo por hora"
        tipo="number"
        min="0"
        step="0.01"
        ayuda="La cancha se crea operativa; el mantenimiento se cambia desde la lista."
      />
    </div>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <div class="formulario__acciones">
      <BotonFz tipo="submit" :cargando="guardando" :disabled="guardando">Crear cancha</BotonFz>
    </div>
  </form>
</template>

<style scoped>
.formulario {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  padding: var(--fz-espaciado-base);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  background: var(--fz-color-superficie);
}

.formulario__campos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--fz-espaciado-base);
  align-items: end;
}

.formulario__campo {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.formulario__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: 600;
  color: var(--fz-color-texto);
}

.formulario__acciones {
  display: flex;
  justify-content: flex-end;
}
</style>
