<script setup lang="ts">
import { AvisoFz, BotonFz, ModalFz } from '@/ui'
import { ETIQUETA_TIPO_CONCEPTO, formatearMonto } from '../presentacion'
import type { Pago } from '../services/servicioPagos'

defineProps<{ pago: Pago | null; anulando: boolean; error: string | null }>()
const emit = defineEmits<{ confirmar: [] }>()

const abierto = defineModel<boolean>({ default: false })
</script>

<template>
  <ModalFz v-model="abierto" titulo="Anular pago" :ocupado="anulando">
    <div v-if="pago" class="confirmar-anulacion">
      <p class="confirmar-anulacion__dato">
        Pago #{{ pago.id }} · {{ ETIQUETA_TIPO_CONCEPTO[pago.concepto.tipo] }} · {{ formatearMonto(pago.monto) }}
      </p>
      <p class="confirmar-anulacion__nota">
        La anulación no se puede deshacer. Si hay que volver a cobrar, se hace con una clave nueva.
      </p>
    </div>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <template #acciones="{ cerrar }">
      <BotonFz variante="secundario" :disabled="anulando" @click="cerrar">Volver</BotonFz>
      <BotonFz variante="peligro" :cargando="anulando" :disabled="anulando" @click="emit('confirmar')">
        Anular pago
      </BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.confirmar-anulacion {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.confirmar-anulacion__dato {
  margin: 0;
}

.confirmar-anulacion__nota {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}
</style>
