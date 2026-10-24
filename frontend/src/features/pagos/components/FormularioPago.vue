<script setup lang="ts">
import { AvisoFz, BotonFz, SelectFz } from '@/ui'
import { MEDIOS_PAGO } from '../presentacion'

defineProps<{ enviando: boolean; error: string | null }>()
const emit = defineEmits<{ pagar: [] }>()

const medio = defineModel<string>({ required: true })
</script>

<template>
  <form class="formulario-pago" @submit.prevent="emit('pagar')">
    <label class="formulario-pago__campo">
      <span class="formulario-pago__etiqueta">Medio de pago</span>
      <SelectFz v-model="medio" :disabled="enviando">
        <option v-for="opcion in MEDIOS_PAGO" :key="opcion.valor" :value="opcion.valor">
          {{ opcion.etiqueta }}
        </option>
      </SelectFz>
    </label>
    <p class="formulario-pago__nota">
      Pago simulado: no se cobra una tarjeta real. El token de la pasarela no se muestra ni se guarda.
    </p>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <div class="formulario-pago__acciones">
      <BotonFz tipo="submit" :cargando="enviando" :disabled="enviando">Pagar</BotonFz>
    </div>
  </form>
</template>

<style scoped>
.formulario-pago {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  padding: var(--fz-espaciado-base);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  background: var(--fz-color-superficie);
}

.formulario-pago__campo {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-width: 22rem;
}

.formulario-pago__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: 600;
  color: var(--fz-color-texto);
}

.formulario-pago__nota {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}

.formulario-pago__acciones {
  display: flex;
  justify-content: flex-end;
}
</style>
