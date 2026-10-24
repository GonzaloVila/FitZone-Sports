<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { BotonFz, InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import {
  ETIQUETA_SITUACION,
  formatearFechaHora,
  formatearHora,
  formatearMonto,
  puedeCancelarse,
  puedePagarse,
  situacionDeReserva,
  type SituacionReserva,
} from '../presentacion'
import type { FilaReserva } from '../tipos'

defineProps<{ filas: FilaReserva[]; cancelando: boolean; ahora: number }>()
const emit = defineEmits<{ cancelar: [fila: FilaReserva] }>()

const COLUMNAS: ColumnaTabla[] = [
  { clave: 'cancha', etiqueta: 'Cancha' },
  { clave: 'turno', etiqueta: 'Turno' },
  { clave: 'estado', etiqueta: 'Estado' },
  { clave: 'precio', etiqueta: 'Precio' },
  { clave: 'acciones', etiqueta: 'Acciones' },
]

function variante(situacion: SituacionReserva): 'exito' | 'peligro' | 'advertencia' | 'neutra' {
  if (situacion === 'proxima') return 'exito'
  if (situacion === 'en-curso') return 'advertencia'
  if (situacion === 'cancelada') return 'peligro'
  return 'neutra'
}
</script>

<template>
  <TablaFz
    titulo="Reservas de cancha"
    :columnas="COLUMNAS"
    :filas="filas"
    :clave-fila="(fila) => fila.reserva.id"
    :ocupada="cancelando"
    ocultar-titulo
  >
    <template #celda-cancha="{ fila }">Cancha #{{ fila.reserva.canchaId }}</template>
    <template #celda-turno="{ fila }">
      {{ formatearFechaHora(fila.reserva.fechaHoraInicio) }} a
      {{ formatearHora(fila.reserva.fechaHoraFin) }}
    </template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="variante(situacionDeReserva(fila.reserva, new Date(ahora)))">
        {{ ETIQUETA_SITUACION[situacionDeReserva(fila.reserva, new Date(ahora))] }}
      </InsigniaFz>
    </template>
    <template #celda-precio="{ fila }">{{ formatearMonto(fila.reserva.precioAplicado) }}</template>
    <template #celda-acciones="{ fila }">
      <div class="tabla-reservas__acciones">
        <BotonFz
          v-if="puedeCancelarse(fila.reserva, new Date(ahora))"
          tamano="sm"
          variante="peligro"
          :disabled="cancelando"
          @click="emit('cancelar', fila)"
        >
          Cancelar
        </BotonFz>
        <template v-if="puedePagarse(fila.reserva.estado)">
          <InsigniaFz v-if="fila.pago === 'pagada'" variante="exito">Pagada</InsigniaFz>
          <RouterLink
            v-else-if="fila.pago !== 'cargando'"
            :to="{ name: 'pagar-reserva', query: { reservaId: fila.reserva.id } }"
          >
            <BotonFz tamano="sm" variante="secundario">Pagar</BotonFz>
          </RouterLink>
        </template>
        <span
          v-if="!puedeCancelarse(fila.reserva, new Date(ahora)) && !puedePagarse(fila.reserva.estado)"
          class="tabla-reservas__vacio"
        >
          —
        </span>
      </div>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-reservas__acciones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.tabla-reservas__vacio {
  color: var(--fz-color-texto-suave);
}
</style>
