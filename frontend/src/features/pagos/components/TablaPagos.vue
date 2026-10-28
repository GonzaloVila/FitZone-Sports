<script setup lang="ts">
import { AccionesFilaFz, InsigniaFz, TablaFz, type AccionFilaFz, type ColumnaTabla } from '@/ui'
import { ETIQUETA_ESTADO_PAGO, ETIQUETA_TIPO_CONCEPTO, formatearFechaHora, formatearMonto } from '../presentacion'
import type { EstadoPago, Pago } from '../services/servicioPagos'

defineProps<{ pagos: Pago[]; ocupada: boolean }>()
const emit = defineEmits<{ comprobante: [pago: Pago]; anular: [pago: Pago] }>()

const COLUMNAS: ColumnaTabla[] = [
  { clave: 'fecha', etiqueta: 'Fecha' },
  { clave: 'usuario', etiqueta: 'Usuario' },
  { clave: 'concepto', etiqueta: 'Concepto' },
  { clave: 'monto', etiqueta: 'Monto' },
  { clave: 'estado', etiqueta: 'Estado' },
  { clave: 'acciones', etiqueta: 'Acciones', etiquetaOculta: true, ajustada: true, alineacion: 'fin' },
]

// Comprobante y anular: como mucho 2 acciones por fila, así que son íconos.
const MAXIMO_DE_ACCIONES = 2

function variante(estado: EstadoPago): 'exito' | 'peligro' | 'advertencia' | 'neutra' {
  if (estado === 'APROBADO') return 'exito'
  if (estado === 'PENDIENTE') return 'advertencia'
  if (estado === 'RECHAZADO') return 'peligro'
  return 'neutra'
}

// "Comprobante" solo en un pago aprobado; "Anular" en uno aprobado o pendiente. Rechazado y anulado no tienen acciones.
function accionesDe(pago: Pago): AccionFilaFz[] {
  const acciones: AccionFilaFz[] = []
  if (pago.estado === 'APROBADO') {
    acciones.push({
      clave: 'comprobante',
      etiqueta: 'Comprobante',
      etiquetaAccesible: `Descargar el comprobante del pago #${pago.id}`,
      icono: 'descargar',
    })
  }
  if (pago.estado === 'APROBADO' || pago.estado === 'PENDIENTE') {
    acciones.push({ clave: 'anular', etiqueta: 'Anular', etiquetaAccesible: `Anular el pago #${pago.id}`, icono: 'cerrar', peligro: true })
  }
  return acciones
}

function alSeleccionar(pago: Pago, clave: string) {
  if (clave === 'comprobante') emit('comprobante', pago)
  else if (clave === 'anular') emit('anular', pago)
}
</script>

<template>
  <TablaFz
    titulo="Pagos"
    :columnas="COLUMNAS"
    :filas="pagos"
    :clave-fila="(pago) => pago.id"
    :ocupada="ocupada"
    ocultar-titulo
  >
    <template #celda-fecha="{ fila }">{{ formatearFechaHora(fila.fechaPago) }}</template>
    <template #celda-usuario="{ fila }">Usuario #{{ fila.usuarioId }}</template>
    <template #celda-concepto="{ fila }">{{ ETIQUETA_TIPO_CONCEPTO[fila.concepto.tipo] }}</template>
    <template #celda-monto="{ fila }">{{ formatearMonto(fila.monto) }}</template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="variante(fila.estado)">{{ ETIQUETA_ESTADO_PAGO[fila.estado] }}</InsigniaFz>
    </template>
    <template #celda-acciones="{ fila }">
      <AccionesFilaFz
        v-if="accionesDe(fila).length > 0"
        :etiqueta="`Acciones del pago #${fila.id}`"
        :identificador="`acciones-pago-${fila.id}`"
        :acciones="accionesDe(fila)"
        :maximo="MAXIMO_DE_ACCIONES"
        @seleccionar="(clave) => alSeleccionar(fila, clave)"
      />
      <span v-else class="tabla-pagos__vacio">—</span>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-pagos__vacio {
  color: var(--fz-color-texto-suave);
}
</style>
