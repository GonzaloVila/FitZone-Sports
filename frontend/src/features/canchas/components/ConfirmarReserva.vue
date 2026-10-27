<script setup lang="ts">
import { AvisoFz, BotonFz, ModalFz } from '@/ui'
import { ETIQUETA_TIPO_CANCHA, formatearDia, formatearMonto, rangoDeTurno } from '../presentacion'
import type { Cancha, Disponibilidad } from '../services/servicioCanchas'

defineProps<{
  cancha: Cancha | null
  turno: Disponibilidad | null
  enviando: boolean
  error: string | null
}>()

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
    <dl v-if="cancha && turno" class="confirmar">
      <div class="confirmar__fila">
        <dt class="confirmar__etiqueta">Cancha</dt>
        <dd class="confirmar__valor">{{ ETIQUETA_TIPO_CANCHA[cancha.tipo] }} #{{ cancha.id }}</dd>
      </div>
      <div class="confirmar__fila">
        <dt class="confirmar__etiqueta">Día</dt>
        <dd class="confirmar__valor">{{ formatearDia(turno.fechaHoraInicio) }}</dd>
      </div>
      <div class="confirmar__fila">
        <dt class="confirmar__etiqueta">Turno</dt>
        <dd class="confirmar__valor">{{ rangoDeTurno(turno.fechaHoraInicio, turno.fechaHoraFin) }}</dd>
      </div>
      <div class="confirmar__fila">
        <dt class="confirmar__etiqueta">Precio base por hora</dt>
        <dd class="confirmar__valor">{{ formatearMonto(cancha.costoPorHora) }}</dd>
      </div>
    </dl>
    <p class="confirmar__nota">El precio final lo calcula el sistema al confirmar la reserva.</p>
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
.confirmar {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
  margin: 0;
}

.confirmar__fila {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--fz-espaciado-compacto);
}

.confirmar__etiqueta {
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-cuerpo);
}

.confirmar__valor {
  margin: 0;
  font-size: var(--fz-texto-cuerpo);
  font-weight: var(--fz-peso-enfasis);
}

.confirmar__nota {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
