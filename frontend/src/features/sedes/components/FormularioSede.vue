<script setup lang="ts">
import { computed } from 'vue'
import { AvisoFz, BotonFz, CampoFormularioFz } from '@/ui'
import type { SedeIn } from '@/features/sedes/services/servicioSedes'

const props = defineProps<{
  form: SedeIn
  guardando: boolean
  errores: Record<string, string>
  // Error general del servidor: se muestra dentro del formulario, sobre los botones.
  error: string | null
}>()

const emit = defineEmits<{
  (e: 'guardar'): void
  (e: 'cancelar'): void
}>()

const aforoMaximoTexto = computed({
  get: () => String(props.form.aforoMaximo),
  set: (val: string) => {
    props.form.aforoMaximo = Number(val) || 0
  },
})
</script>

<template>
  <form class="formulario-sede" novalidate @submit.prevent="emit('guardar')">
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

    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <div class="formulario-sede__acciones">
      <BotonFz variante="fantasma" :disabled="guardando" @click="emit('cancelar')">Cancelar</BotonFz>
      <BotonFz tipo="submit" :cargando="guardando">Guardar</BotonFz>
    </div>
  </form>
</template>

<style scoped>
.formulario-sede {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  padding: var(--fz-espaciado-amplio);
  border: 1px solid var(--fz-color-borde-marcado);
  border-radius: var(--fz-radio-control);
  background: var(--fz-color-fondo);
}

.formulario-sede__acciones {
  display: flex;
  justify-content: flex-end;
  gap: var(--fz-espaciado-compacto);
}
</style>
