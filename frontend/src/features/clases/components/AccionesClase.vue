<script setup lang="ts">
import { computed } from 'vue'
import { BotonFz, InsigniaFz } from '@/ui'
import { ETIQUETAS_ESTADO_ESPERA, VARIANTES_ESTADO_ESPERA } from '../presentacion'
import { MOTIVO_CLASE_COMENZADA, MOTIVO_VENTANA_NO_ABIERTA, momentoDeClase } from '../reglas'
import type { Clase, EsperaClase, ReservaClase } from '../services/servicioClases'

const props = defineProps<{
  clase: Clase
  reserva: ReservaClase | null
  espera: EsperaClase | null
  posicionEnEspera: number | null
  ahora: number
  ocupado?: boolean
}>()

defineEmits<{
  (e: 'reservar'): void
  (e: 'cancelar'): void
  (e: 'anotarse'): void
  (e: 'confirmar'): void
  (e: 'salir'): void
}>()

const momento = computed(() => momentoDeClase(props.clase, props.ahora))
const sinCupos = computed(() => props.clase.cupoDisponible <= 0)
const tieneReserva = computed(() => props.reserva?.estado === 'CONFIRMADA')

// Motivo por el que no se puede reservar ni anotarse (null = se puede).
const motivo = computed(() => {
  if (momento.value === 'comenzada') return MOTIVO_CLASE_COMENZADA
  if (!sinCupos.value && momento.value === 'ventana-cerrada') return MOTIVO_VENTANA_NO_ABIERTA
  return null
})
</script>

<template>
  <div class="acciones-clase">
    <!-- Reserva vigente -->
    <template v-if="tieneReserva">
      <InsigniaFz variante="exito">Tenés un cupo reservado</InsigniaFz>
      <BotonFz v-if="momento !== 'comenzada'" variante="peligro" :disabled="ocupado" @click="$emit('cancelar')">
        Cancelar reserva
      </BotonFz>
      <p v-else class="acciones-clase__motivo">{{ MOTIVO_CLASE_COMENZADA }}</p>
    </template>

    <!-- Lista de espera propia -->
    <template v-else-if="espera">
      <InsigniaFz :variante="VARIANTES_ESTADO_ESPERA[espera.estado]">
        {{ ETIQUETAS_ESTADO_ESPERA[espera.estado] }}
      </InsigniaFz>
      <p v-if="espera.estado === 'EN_ESPERA' && posicionEnEspera !== null" class="acciones-clase__motivo">
        Estás en el lugar {{ posicionEnEspera }} de la lista de espera.
      </p>
      <p v-if="espera.estado === 'NOTIFICADO'" class="acciones-clase__motivo">
        Se liberó un cupo. Se queda con él el primero que confirme.
      </p>
      <BotonFz v-if="espera.estado === 'NOTIFICADO'" variante="primario" :disabled="ocupado" @click="$emit('confirmar')">
        Confirmar cupo
      </BotonFz>
      <BotonFz variante="secundario" :disabled="ocupado" @click="$emit('salir')">Salir de la espera</BotonFz>
    </template>

    <!-- Sin reserva ni espera -->
    <template v-else>
      <p v-if="motivo" class="acciones-clase__motivo">{{ motivo }}</p>
      <BotonFz v-else-if="sinCupos" variante="secundario" :disabled="ocupado" @click="$emit('anotarse')">
        Anotarme en lista de espera
      </BotonFz>
      <BotonFz v-else variante="primario" :disabled="ocupado" @click="$emit('reservar')">Reservar</BotonFz>
    </template>
  </div>
</template>

<style scoped>
.acciones-clase {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.acciones-clase__motivo {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}
</style>
