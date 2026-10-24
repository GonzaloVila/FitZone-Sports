<script setup lang="ts">
import { BotonFz, InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
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
  { clave: 'acciones', etiqueta: 'Acciones' },
]

function variante(estado: EstadoPago): 'exito' | 'peligro' | 'advertencia' | 'neutra' {
  if (estado === 'APROBADO') return 'exito'
  if (estado === 'PENDIENTE') return 'advertencia'
  if (estado === 'RECHAZADO') return 'peligro'
  return 'neutra'
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
      <div class="tabla-pagos__acciones">
        <BotonFz
          v-if="fila.estado === 'APROBADO'"
          tamano="sm"
          variante="secundario"
          @click="emit('comprobante', fila)"
        >
          Comprobante
        </BotonFz>
        <BotonFz
          v-if="fila.estado === 'APROBADO' || fila.estado === 'PENDIENTE'"
          tamano="sm"
          variante="peligro"
          @click="emit('anular', fila)"
        >
          Anular
        </BotonFz>
        <span v-if="fila.estado === 'RECHAZADO' || fila.estado === 'ANULADO'" class="tabla-pagos__vacio">—</span>
      </div>
    </template>
  </TablaFz>
</template>

<style scoped>
.tabla-pagos__acciones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.tabla-pagos__vacio {
  color: var(--fz-color-texto-suave);
}
</style>
