<script setup lang="ts">
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { CampoFormularioFz, SelectFz } from '@/ui'
import { ETIQUETA_TIPO_CANCHA, TIPOS_CANCHA } from '../presentacion'
import type { FormularioCanchaDatos } from '../tipos'

defineProps<{
  form: FormularioCanchaDatos
  sedes: Sede[]
  guardando: boolean
  errores: Record<string, string>
  // Id del <form>: los botones del pie del modal lo envían con el atributo `form`.
  idFormulario: string
}>()

defineEmits<{
  (e: 'guardar'): void
}>()
</script>

<template>
  <form :id="idFormulario" class="formulario-cancha" novalidate @submit.prevent="$emit('guardar')">
    <CampoFormularioFz etiqueta="Sede" etiqueta-chica obligatorio :error="errores.sedeId">
      <template #default="{ id, describedby, invalido }">
        <SelectFz
          :id="id"
          v-model="form.sedeId"
          name="sedeId"
          aria-required="true"
          :invalido="invalido"
          :aria-describedby="describedby"
          :disabled="guardando"
        >
          <option value="" disabled>Elegí una sede</option>
          <option v-for="sede in sedes" :key="sede.id" :value="String(sede.id)">{{ sede.nombre }}</option>
        </SelectFz>
      </template>
    </CampoFormularioFz>

    <CampoFormularioFz etiqueta="Deporte" etiqueta-chica obligatorio :error="errores.tipo">
      <template #default="{ id, describedby, invalido }">
        <SelectFz
          :id="id"
          v-model="form.tipo"
          name="tipo"
          aria-required="true"
          :invalido="invalido"
          :aria-describedby="describedby"
          :disabled="guardando"
        >
          <option v-for="valor in TIPOS_CANCHA" :key="valor" :value="valor">{{ ETIQUETA_TIPO_CANCHA[valor] }}</option>
        </SelectFz>
      </template>
    </CampoFormularioFz>

    <CampoFormularioFz
      v-model="form.costoPorHora"
      etiqueta="Costo por hora"
      etiqueta-chica
      obligatorio
      tipo="number"
      name="costoPorHora"
      min="0"
      step="0.01"
      autocomplete="off"
      ayuda="La cancha se crea operativa; el mantenimiento se cambia desde la gestión."
      :error="errores.costoPorHora"
      :disabled="guardando"
    />
  </form>
</template>

<style scoped>
.formulario-cancha {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}
</style>
