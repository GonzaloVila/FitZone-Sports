<script setup lang="ts">
import { computed } from 'vue'
import { AvisoFz, BotonFz, ListaDatosFz, ModalFz, type DatoFz } from '@/ui'
import { nombreDeCancha } from '../edicion'
import { formatearDia, formatearMonto, rangoDeTurno } from '../presentacion'
import type { Cancha, Disponibilidad } from '../services/servicioCanchas'

const props = defineProps<{
  cancha: Cancha | null
  turno: Disponibilidad | null
  enviando: boolean
  error: string | null
}>()

const datos = computed<DatoFz[]>(() => {
  if (!props.cancha || !props.turno) return []
  return [
    { etiqueta: 'Cancha', valor: nombreDeCancha(props.cancha) },
    { etiqueta: 'Día', valor: formatearDia(props.turno.fechaHoraInicio) },
    { etiqueta: 'Turno', valor: rangoDeTurno(props.turno.fechaHoraInicio, props.turno.fechaHoraFin) },
    { etiqueta: 'Precio base por hora', valor: formatearMonto(props.cancha.costoPorHora) },
  ]
})

const abierto = defineModel<boolean>({ default: false })

defineEmits<{
  (e: 'confirmar'): void
}>()
</script>

<template>
  <ModalFz
    v-model="abierto"
    titulo="Confirmar reserva"
    descripcion="Revisá los datos del turno antes de confirmar."
    icono="canchas"
    tono="primario"
    ancho="angosto"
    :ocupado="enviando"
  >
    <ListaDatosFz v-if="datos.length > 0" :datos="datos" />
    <p class="confirmar__nota">El precio final puede variar según tu membresía y el horario.</p>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <template #acciones="{ cerrar }">
      <BotonFz variante="fantasma" :disabled="enviando" @click="cerrar">Volver</BotonFz>
      <BotonFz :cargando="enviando" @click="$emit('confirmar')">
        {{ enviando ? 'Reservando…' : 'Confirmar reserva' }}
      </BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.confirmar__nota {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
