<script setup lang="ts">
import { computed } from 'vue'
import { AccionesFilaFz, InsigniaFz, TablaFz, type AccionFilaFz, type ColumnaTabla } from '@/ui'
import {
  accionesDeReserva,
  formatearFechaHora,
  formatearHora,
  formatearMonto,
  identificadorDeAccionesReserva,
  insigniaDePago,
  type AccionReserva,
  type PestanaReservas,
} from '../presentacion'
import type { ReservaCancha } from '../services/servicioCanchas'
import type { FilaReserva } from '../tipos'

const props = defineProps<{
  filas: FilaReserva[]
  ahora: number
  // La pestaña dice si las reservas son próximas, pasadas o canceladas: la tabla solo dice si están pagas. Solo Próximas
  // tiene columna de acciones.
  pestana: PestanaReservas
  // El nombre ("Fútbol 5 #2") y la sede de la cancha de una reserva, que la reserva no trae.
  etiquetaDeCancha: (canchaId: number) => string
  nombreDeSede: (canchaId: number) => string
  ocupada?: boolean
}>()

const emit = defineEmits<{ pagar: [fila: FilaReserva]; cancelar: [fila: FilaReserva] }>()

// Como en la lista de canchas: las columnas se reparten el ancho y solo la última (las acciones) ocupa lo que necesita.
const columnas = computed<ColumnaTabla[]>(() => [
  { clave: 'cancha', etiqueta: 'Cancha', encabezadoFila: true },
  { clave: 'sede', etiqueta: 'Sede' },
  { clave: 'turno', etiqueta: 'Turno' },
  { clave: 'pago', etiqueta: 'Pago' },
  { clave: 'precio', etiqueta: 'Precio' },
  ...(props.pestana === 'proximas'
    ? [{ clave: 'acciones', etiqueta: 'Acciones', conDivisor: true, ajustada: true, alineacion: 'centro' as const }]
    : []),
])

// Pagar y cancelar: como mucho 2 acciones por fila, así que son íconos.
const MAXIMO_DE_ACCIONES = 2

const claveFila = (fila: FilaReserva) => fila.reserva.id
const turno = (reserva: ReservaCancha) =>
  `${formatearFechaHora(reserva.fechaHoraInicio)} a ${formatearHora(reserva.fechaHoraFin)}`
const insignia = (fila: FilaReserva) => insigniaDePago(fila.pago, props.pestana)
const textoSinInsignia = (fila: FilaReserva) => (fila.pago === 'cargando' ? 'Consultando…' : 'Sin dato')

// Las acciones de una reserva: solo las que se pueden hacer ahora, con el dato de la fila en el nombre accesible.
function accionesDe(fila: FilaReserva): AccionFilaFz[] {
  const reserva = `la reserva de ${props.etiquetaDeCancha(fila.reserva.canchaId)} (${turno(fila.reserva)})`
  const textos: Record<AccionReserva, Pick<AccionFilaFz, 'etiqueta' | 'etiquetaAccesible' | 'icono'>> = {
    pagar: { etiqueta: 'Pagar', etiquetaAccesible: `Pagar ${reserva}`, icono: 'pagos' },
    cancelar: { etiqueta: 'Cancelar reserva', etiquetaAccesible: `Cancelar ${reserva}`, icono: 'cerrar' },
  }
  return accionesDeReserva(fila.reserva, fila.pago, new Date(props.ahora)).map((accion) => ({
    clave: accion.clave,
    ...textos[accion.clave],
    deshabilitada: accion.deshabilitada,
    peligro: accion.clave === 'cancelar',
  }))
}

function alSeleccionar(fila: FilaReserva, clave: string) {
  if (clave === 'pagar') emit('pagar', fila)
  else if (clave === 'cancelar') emit('cancelar', fila)
}
</script>

<template>
  <TablaFz titulo="Reservas de cancha" ocultar-titulo :columnas="columnas" :filas="filas" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-cancha="{ fila }">
      <span class="tabla-reservas__nombre">{{ etiquetaDeCancha(fila.reserva.canchaId) }}</span>
    </template>
    <template #celda-sede="{ fila }">{{ nombreDeSede(fila.reserva.canchaId) }}</template>
    <template #celda-turno="{ fila }">{{ turno(fila.reserva) }}</template>
    <template #celda-pago="{ fila }">
      <InsigniaFz v-if="insignia(fila)" :variante="insignia(fila)?.variante">{{ insignia(fila)?.texto }}</InsigniaFz>
      <span v-else class="tabla-reservas__tenue">{{ textoSinInsignia(fila) }}</span>
    </template>
    <template #celda-precio="{ fila }">{{ formatearMonto(fila.reserva.precioAplicado) }}</template>
    <template #celda-acciones="{ fila }">
      <AccionesFilaFz
        :etiqueta="`Acciones de la reserva de ${etiquetaDeCancha(fila.reserva.canchaId)} (${turno(fila.reserva)})`"
        :identificador="identificadorDeAccionesReserva(fila.reserva.id)"
        :acciones="accionesDe(fila)"
        :maximo="MAXIMO_DE_ACCIONES"
        @seleccionar="(clave) => alSeleccionar(fila, clave)"
      />
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-reservas__nombre {
  font-weight: var(--fz-peso-enfasis);
}

.tabla-reservas__tenue {
  color: var(--fz-color-texto-suave);
}
</style>
