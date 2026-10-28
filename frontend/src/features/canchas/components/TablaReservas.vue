<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { InsigniaFz, MenuAccionesFz, TablaFz, type AccionMenuFz, type ColumnaTabla } from '@/ui'
import { PARAMETROS_DESDE_MIS_RESERVAS } from '../direccion'
import {
  accionesDeReserva,
  formatearFechaHora,
  formatearHora,
  formatearMonto,
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
  ...(props.pestana === 'proximas' ? [{ clave: 'acciones', etiqueta: 'Acciones', ajustada: true, alineacion: 'fin' as const }] : []),
])

const ETIQUETA_ACCION: Record<AccionReserva, { etiqueta: string; icono: AccionMenuFz['icono'] }> = {
  pagar: { etiqueta: 'Pagar', icono: 'pagos' },
  cancelar: { etiqueta: 'Cancelar', icono: 'cerrar' },
}

const claveFila = (fila: FilaReserva) => fila.reserva.id
const turno = (reserva: ReservaCancha) =>
  `${formatearFechaHora(reserva.fechaHoraInicio)} a ${formatearHora(reserva.fechaHoraFin)}`
const insignia = (fila: FilaReserva) => insigniaDePago(fila.pago, props.pestana)
const textoSinInsignia = (fila: FilaReserva) => (fila.pago === 'cargando' ? 'Consultando…' : 'Sin dato')

// El menú de una reserva: solo las acciones que se pueden hacer ahora (ninguna → sin menú).
const accionesDe = (fila: FilaReserva): AccionMenuFz[] =>
  accionesDeReserva(fila.reserva, fila.pago, new Date(props.ahora)).map((accion, posicion) => ({
    clave: accion.clave,
    ...ETIQUETA_ACCION[accion.clave],
    deshabilitada: accion.deshabilitada,
    // "Cancelar" va aparte y en rojo, salvo que sea la única.
    peligro: accion.clave === 'cancelar',
    separada: accion.clave === 'cancelar' && posicion > 0,
  }))

function alSeleccionar(fila: FilaReserva, clave: string) {
  if (clave === 'pagar') emit('pagar', fila)
  else if (clave === 'cancelar') emit('cancelar', fila)
}
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
    <template #celda-sede="{ fila }">{{ nombreDeSede(fila.reserva.canchaId) }}</template>
    <template #celda-turno="{ fila }">{{ turno(fila.reserva) }}</template>
    <template #celda-pago="{ fila }">
      <InsigniaFz v-if="insignia(fila)" :variante="insignia(fila)?.variante">{{ insignia(fila)?.texto }}</InsigniaFz>
      <span v-else class="tabla-reservas__tenue">{{ textoSinInsignia(fila) }}</span>
    </template>
    <template #celda-precio="{ fila }">{{ formatearMonto(fila.reserva.precioAplicado) }}</template>
    <template #celda-acciones="{ fila }">
      <MenuAccionesFz
        v-if="accionesDe(fila).length > 0"
        :etiqueta="`Acciones de la reserva de ${etiquetaDeCancha(fila.reserva.canchaId)} (${turno(fila.reserva)})`"
        :identificador="`menu-reserva-${fila.reserva.id}`"
        :acciones="accionesDe(fila)"
        @seleccionar="(clave) => alSeleccionar(fila, clave)"
      />
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

.tabla-reservas__tenue {
  color: var(--fz-color-texto-suave);
}
</style>
