<script setup lang="ts">
import { computed } from 'vue'
import { CampoFormularioFz } from '@/ui'
import type { SedeIn } from '@/features/sedes/services/servicioSedes'

const props = defineProps<{
  form: SedeIn
  guardando: boolean
  errores: Record<string, string>
  // Id del <form>: los botones del pie del modal lo envían con el atributo `form`.
  idFormulario: string
}>()

const emit = defineEmits<{
  (e: 'guardar'): void
}>()

const aforoMaximoTexto = computed({
  get: () => String(props.form.aforoMaximo),
  set: (val: string) => {
    props.form.aforoMaximo = Number(val) || 0
  },
})
</script>

<template>
  <form :id="idFormulario" class="formulario-sede" novalidate @submit.prevent="emit('guardar')">
    <CampoFormularioFz
      v-model="form.nombre"
      etiqueta="Nombre de la sede"
      etiqueta-chica
      obligatorio
      name="nombre"
      placeholder="Ej: FitZone Centro"
      autocomplete="off"
      :error="errores.nombre"
      :disabled="guardando"
    />

    <CampoFormularioFz
      v-model="form.direccion"
      etiqueta="Dirección"
      etiqueta-chica
      obligatorio
      name="direccion"
      placeholder="Calle, número y ciudad"
      autocomplete="off"
      :error="errores.direccion"
      :disabled="guardando"
    />

    <CampoFormularioFz
      v-model="aforoMaximoTexto"
      etiqueta="Capacidad máxima"
      etiqueta-chica
      obligatorio
      name="aforoMaximo"
      tipo="number"
      min="1"
      ayuda="Cantidad de socios que pueden estar a la vez en la sede."
      :error="errores.aforoMaximo"
      :disabled="guardando"
    />
  </form>
</template>

<style scoped>
.formulario-sede {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}
</style>
