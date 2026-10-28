<script setup lang="ts">
import { AvisoFz, BotonFz, ModalFz } from '@/ui'
import { formatearFechaHora, formatearHora } from '../presentacion'
import type { ReservaCancha } from '../services/servicioCanchas'

defineProps<{
  reserva: ReservaCancha | null
  // El nombre de la cancha de la reserva ("Fútbol 5 #2").
  nombreCancha?: string
  cargando?: boolean
  error?: string | null
}>()

const abierto = defineModel<boolean>({ required: true })

defineEmits<{
  (e: 'confirmar'): void
}>()
</script>

<template>
  <ModalFz v-model="abierto" titulo="Cancelar reserva" icono="cerrar" tono="peligro" ancho="angosto" :ocupado="cargando">
    <p v-if="reserva" class="modal-cancelar__texto">
      ¿Querés cancelar tu reserva de <strong>{{ nombreCancha ?? `Cancha #${reserva.canchaId}` }}</strong>
      ({{ formatearFechaHora(reserva.fechaHoraInicio) }} a {{ formatearHora(reserva.fechaHoraFin) }})? No se puede deshacer.
    </p>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <template #acciones="{ cerrar }">
      <BotonFz variante="secundario" :disabled="cargando" @click="cerrar">Volver</BotonFz>
      <BotonFz variante="peligro" :cargando="cargando" @click="$emit('confirmar')">
        {{ cargando ? 'Cancelando…' : 'Cancelar reserva' }}
      </BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.modal-cancelar__texto {
  margin: 0;
}
</style>
