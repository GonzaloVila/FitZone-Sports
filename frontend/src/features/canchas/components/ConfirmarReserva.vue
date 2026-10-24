<script setup lang="ts">
import { AvisoFz, BotonFz, ModalFz } from '@/ui'
import { ETIQUETA_TIPO_CANCHA, formatearMonto, rangoDeTurno } from '../presentacion'
import type { Cancha, Disponibilidad } from '../services/servicioCanchas'

defineProps<{
  cancha: Cancha | null
  turno: Disponibilidad | null
  enviando: boolean
  error: string | null
}>()

const abierto = defineModel<boolean>({ default: false })
const emit = defineEmits<{ confirmar: [] }>()
</script>

<template>
  <ModalFz v-model="abierto" titulo="Confirmar reserva" :ocupado="enviando">
    <div v-if="cancha && turno" class="confirmar">
      <p class="confirmar__dato">
        <strong>Cancha:</strong> {{ ETIQUETA_TIPO_CANCHA[cancha.tipo] }} #{{ cancha.id }}
      </p>
      <p class="confirmar__dato">
        <strong>Turno:</strong> {{ rangoDeTurno(turno.fechaHoraInicio, turno.fechaHoraFin) }}
      </p>
      <p class="confirmar__dato">
        <strong>Precio base por hora:</strong> {{ formatearMonto(cancha.costoPorHora) }}
      </p>
      <p class="confirmar__nota">El precio final lo calcula el servidor al confirmar la reserva.</p>
    </div>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <template #acciones="{ cerrar }">
      <BotonFz variante="secundario" :disabled="enviando" @click="cerrar">Volver</BotonFz>
      <BotonFz :cargando="enviando" :disabled="enviando" @click="emit('confirmar')">
        Confirmar reserva
      </BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.confirmar {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.confirmar__dato {
  margin: 0;
}

.confirmar__nota {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}
</style>
