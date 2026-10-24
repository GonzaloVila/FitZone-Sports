<script setup lang="ts">
import { computed } from 'vue'
import { AvisoFz, BotonFz } from '@/ui'
import { ETIQUETA_ESTADO_PAGO, formatearMonto } from '../presentacion'
import type { Pago } from '../services/servicioPagos'

const props = defineProps<{ pago: Pago; descargando: boolean }>()
const emit = defineEmits<{ comprobante: [] }>()

const variante = computed(() => {
  if (props.pago.estado === 'APROBADO') return 'exito' as const
  if (props.pago.estado === 'PENDIENTE') return 'advertencia' as const
  return 'peligro' as const
})
</script>

<template>
  <div class="resultado-pago">
    <AvisoFz :variante="variante">
      <p class="resultado-pago__titulo">Pago {{ ETIQUETA_ESTADO_PAGO[pago.estado].toLowerCase() }}</p>
      <p class="resultado-pago__detalle">Pago #{{ pago.id }} · {{ formatearMonto(pago.monto) }}</p>
    </AvisoFz>
    <div v-if="pago.estado === 'APROBADO'" class="resultado-pago__acciones">
      <BotonFz variante="secundario" :cargando="descargando" :disabled="descargando" @click="emit('comprobante')">
        Descargar comprobante
      </BotonFz>
    </div>
  </div>
</template>

<style scoped>
.resultado-pago {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.resultado-pago__titulo {
  margin: 0;
  font-weight: 700;
}

.resultado-pago__detalle {
  margin: 0.25rem 0 0;
}

.resultado-pago__acciones {
  display: flex;
  justify-content: flex-start;
}
</style>
