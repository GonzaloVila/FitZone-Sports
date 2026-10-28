<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { BotonFz, InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { PARAMETROS_DESDE_MIS_RESERVAS } from '../direccion'
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
import type { ReservaCancha } from '../services/servicioCanchas'
import type { FilaReserva } from '../tipos'

const props = defineProps<{
  filas: FilaReserva[]
  ahora: number
  // El nombre de la cancha de una reserva ("Fútbol 5 #2"), que la reserva no trae.
  etiquetaDeCancha: (canchaId: number) => string
  ocupada?: boolean
}>()

const emit = defineEmits<{ cancelar: [fila: FilaReserva] }>()

const columnas: ColumnaTabla[] = [
  { clave: 'cancha', etiqueta: 'Cancha', encabezadoFila: true },
  { clave: 'turno', etiqueta: 'Turno' },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
  { clave: 'precio', etiqueta: 'Precio', ajustada: true },
  { clave: 'acciones', etiqueta: 'Acciones', ajustada: true, alineacion: 'fin' },
]

const VARIANTES: Record<SituacionReserva, 'exito' | 'peligro' | 'advertencia' | 'neutra'> = {
  proxima: 'exito',
  'en-curso': 'advertencia',
  cumplida: 'neutra',
  cancelada: 'peligro',
}

const claveFila = (fila: FilaReserva) => fila.reserva.id
const situacion = (reserva: ReservaCancha) => situacionDeReserva(reserva, new Date(props.ahora))
const cancelable = (reserva: ReservaCancha) => puedeCancelarse(reserva, new Date(props.ahora))
const turno = (reserva: ReservaCancha) =>
  `${formatearFechaHora(reserva.fechaHoraInicio)} a ${formatearHora(reserva.fechaHoraFin)}`

// "Pagada" es un estado (va junto a "Próxima" etc.); "Pagar" es una acción y solo se ofrece si falta pagar. Mientras se
// consulta el pago no se ofrece ninguna de las dos.
const estaPagada = (fila: FilaReserva) => puedePagarse(fila.reserva.estado) && fila.pago === 'pagada'
const puedePagar = (fila: FilaReserva) =>
  puedePagarse(fila.reserva.estado) && fila.pago !== 'pagada' && fila.pago !== 'cargando'
const sinAcciones = (fila: FilaReserva) =>
  !cancelable(fila.reserva) && !puedePagar(fila) && !(puedePagarse(fila.reserva.estado) && fila.pago === 'cargando')
</script>

<template>
  <TablaFz titulo="Reservas de cancha" ocultar-titulo :columnas="columnas" :filas="filas" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-cancha="{ fila }">
      <RouterLink
        :to="{ name: 'cancha-turnos', params: { canchaId: fila.reserva.canchaId }, query: PARAMETROS_DESDE_MIS_RESERVAS }"
        class="tabla-reservas__enlace"
      >
        {{ etiquetaDeCancha(fila.reserva.canchaId) }}
      </RouterLink>
    </template>
    <template #celda-turno="{ fila }">{{ turno(fila.reserva) }}</template>
    <template #celda-estado="{ fila }">
      <div class="tabla-reservas__estado">
        <InsigniaFz :variante="VARIANTES[situacion(fila.reserva)]">{{ ETIQUETA_SITUACION[situacion(fila.reserva)] }}</InsigniaFz>
        <InsigniaFz v-if="estaPagada(fila)" variante="exito">Pagada</InsigniaFz>
      </div>
    </template>
    <template #celda-precio="{ fila }">{{ formatearMonto(fila.reserva.precioAplicado) }}</template>
    <template #celda-acciones="{ fila }">
      <div class="tabla-reservas__acciones">
        <BotonFz
          v-if="cancelable(fila.reserva)"
          tamano="sm"
          variante="secundario"
          :disabled="ocupada"
          :aria-label="`Cancelar la reserva de ${etiquetaDeCancha(fila.reserva.canchaId)} (${turno(fila.reserva)})`"
          @click="emit('cancelar', fila)"
        >
          Cancelar
        </BotonFz>
        <RouterLink
          v-if="puedePagar(fila)"
          v-slot="{ href, navigate }"
          :to="{ name: 'pagar-reserva', query: { reservaId: fila.reserva.id } }"
          custom
        >
          <BotonFz
            como="a"
            variante="secundario"
            tamano="sm"
            :href="href"
            :aria-label="`Pagar la reserva de ${etiquetaDeCancha(fila.reserva.canchaId)} (${turno(fila.reserva)})`"
            @click="navigate"
          >
            Pagar
          </BotonFz>
        </RouterLink>
        <span v-if="sinAcciones(fila)" class="tabla-reservas__tenue">—</span>
      </div>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-reservas__enlace {
  color: var(--fz-color-texto);
  font-weight: var(--fz-peso-enfasis);
  text-decoration: none;
}

.tabla-reservas__enlace:hover {
  text-decoration: underline;
}

.tabla-reservas__enlace:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}

.tabla-reservas__estado,
.tabla-reservas__acciones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.tabla-reservas__acciones {
  justify-content: flex-end;
}

.tabla-reservas__tenue {
  color: var(--fz-color-texto-suave);
}
</style>
