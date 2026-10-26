<script setup lang="ts">
import { OpcionesTarjetaFz } from '@/ui'
import type { AltaSocio } from '../../../composables/useAltaSocio'
import { OPCIONES_PLAN } from '../../../presentacion'

defineProps<{
  alta: AltaSocio
  nombreSede: string
}>()
</script>

<template>
  <div class="plan">
    <p class="plan__resumen">
      Se dará de alta a <strong>{{ alta.nombreDelSocio }}</strong> en la sede <strong>{{ nombreSede }}</strong>.
    </p>
    <OpcionesTarjetaFz
      v-model="alta.plan"
      nombre="plan"
      leyenda="Plan de la membresía"
      :opciones="OPCIONES_PLAN"
      :deshabilitado="alta.enviando"
    />
    <p v-if="alta.errores.plan" class="plan__error" role="alert">{{ alta.errores.plan }}</p>
  </div>
</template>

<style scoped>
.plan {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.plan__resumen,
.plan__error {
  margin: 0;
}

.plan__error {
  color: var(--fz-color-peligro);
  font-size: var(--fz-texto-pequeno);
}
</style>
