<script setup lang="ts">
import { computed } from 'vue'
import { BotonFz, CampoFormularioFz } from '@/ui'
import type { SedeIn } from '@/features/sedes/services/servicioSedes'

const props = defineProps<{
  form: SedeIn
  guardando: boolean
  errores: Record<string, string>
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
  <form class="formulario-sede" @submit.prevent="emit('guardar')">
    <CampoFormularioFz
      v-model="form.nombre"
      etiqueta="Nombre de la sede"
      name="nombre"
      :error="errores.nombre"
      ayuda="Ej: FitZone Centro"
      placeholder="Nombre de la sucursal"
      :disabled="guardando"
      required
    />

    <CampoFormularioFz
      v-model="form.direccion"
      etiqueta="Dirección"
      name="direccion"
      :error="errores.direccion"
      ayuda="Calle, número y ciudad"
      placeholder="Ej: Av. Colón 1200, Córdoba"
      :disabled="guardando"
      required
    />

    <CampoFormularioFz
      v-model="aforoMaximoTexto"
      etiqueta="Capacidad máxima (Aforo)"
      name="aforoMaximo"
      tipo="number"
      min="1"
      :error="errores.aforoMaximo"
      ayuda="Cantidad máxima de socios simultáneos en la sede"
      :disabled="guardando"
      required
    />

    <div class="formulario-sede__acciones">
      <BotonFz
        variante="primario"
        tipo="submit"
        :cargando="guardando"
        :disabled="guardando"
      >
        {{ guardando ? 'Creando sede…' : 'Crear Sede' }}
      </BotonFz>
    </div>
  </form>
</template>

<style scoped>
.formulario-sede {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espacio-4, 1rem);
  background: var(--fz-color-fondo, #ffffff);
  border: 1px solid var(--fz-color-borde, #e5e7eb);
  border-radius: var(--fz-radio-lg, 0.5rem);
  padding: var(--fz-espacio-6, 1.5rem);
  max-width: 32rem;
}

.formulario-sede__acciones {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--fz-espacio-2, 0.5rem);
}
</style>
