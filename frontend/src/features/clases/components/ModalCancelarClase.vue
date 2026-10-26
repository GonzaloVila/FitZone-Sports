<script setup lang="ts">
import { computed } from 'vue'
import { AvisoFz, BotonFz, ModalFz } from '@/ui'
import { cancelacionConPenalidad } from '../reglas'
import { formatearHorario } from '../presentacion'
import type { Clase } from '../services/servicioClases'

const props = defineProps<{
  clase: Clase | null
  ahora: number
  cargando?: boolean
  error?: string | null
}>()

const abierto = defineModel<boolean>({ required: true })

defineEmits<{
  (e: 'confirmar'): void
}>()

const conPenalidad = computed(() => (props.clase ? cancelacionConPenalidad(props.clase, props.ahora) : false))
</script>

<template>
  <ModalFz v-model="abierto" titulo="Cancelar reserva" icono="cerrar" tono="peligro" ancho="angosto" :ocupado="cargando">
    <p v-if="clase" class="modal-cancelar__texto">
      ¿Querés cancelar tu cupo en <strong>{{ clase.tipo }}</strong> ({{ formatearHorario(clase) }})?
    </p>
    <AvisoFz v-if="conPenalidad" variante="advertencia">
      Se cobrará una penalidad del 50 % del valor de la clase.
    </AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <template #acciones="{ cerrar }">
      <BotonFz variante="secundario" :disabled="cargando" @click="cerrar">Volver</BotonFz>
      <BotonFz variante="peligro" :cargando="cargando" @click="$emit('confirmar')">
        {{ conPenalidad ? 'Cancelar y pagar penalidad' : 'Cancelar reserva' }}
      </BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.modal-cancelar__texto {
  margin: 0;
}
</style>
