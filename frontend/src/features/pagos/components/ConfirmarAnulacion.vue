<script setup lang="ts">
import { computed } from 'vue'
import { AvisoFz, BotonFz, ListaDatosFz, ModalFz, type DatoFz } from '@/ui'
import { ETIQUETA_TIPO_CONCEPTO, formatearFechaHora, formatearMonto } from '../presentacion'
import type { Pago } from '../services/servicioPagos'

const props = defineProps<{ pago: Pago | null; anulando: boolean; error: string | null }>()
const emit = defineEmits<{ confirmar: [] }>()

const abierto = defineModel<boolean>({ default: false })

const datos = computed<DatoFz[]>(() => {
  const pago = props.pago
  if (!pago) return []
  return [
    { etiqueta: 'Pago', valor: `#${pago.id}` },
    { etiqueta: 'Concepto', valor: ETIQUETA_TIPO_CONCEPTO[pago.concepto.tipo] },
    { etiqueta: 'Usuario', valor: `Usuario #${pago.usuarioId}` },
    { etiqueta: 'Fecha', valor: formatearFechaHora(pago.fechaPago) },
    { etiqueta: 'Monto', valor: formatearMonto(pago.monto), destacado: true },
  ]
})
</script>

<template>
  <ModalFz v-model="abierto" titulo="Anular pago" icono="advertencia" tono="peligro" ancho="angosto" :ocupado="anulando">
    <template v-if="pago">
      <ListaDatosFz :datos="datos" />
      <p class="nota">La anulación no se puede deshacer. Si hay que volver a cobrar, se hace con una clave nueva.</p>
    </template>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <template #acciones="{ cerrar }">
      <BotonFz variante="secundario" :disabled="anulando" @click="cerrar">Cancelar</BotonFz>
      <BotonFz variante="peligro" :cargando="anulando" :disabled="anulando" @click="emit('confirmar')">
        Anular pago
      </BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.nota {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}
</style>
