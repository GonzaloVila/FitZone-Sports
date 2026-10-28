<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { AccionesFilaFz, InsigniaFz, TablaFz, type AccionFilaFz, type ColumnaTabla } from '@/ui'
import { identificadorDeAccionesCancha, nombreDeCancha } from '../edicion'
import { ETIQUETA_ESTADO_CANCHA, ETIQUETA_TIPO_CANCHA, formatearMonto } from '../presentacion'
import type { Cancha } from '../services/servicioCanchas'

const props = defineProps<{
  canchas: Cancha[]
  // Parámetros de dirección del enlace a la grilla de turnos (de dónde se vino y con qué filtros).
  parametrosDetalle?: Record<string, string>
  // Suma la columna Sede (con "Todas las sedes" y para el RECEPCION, cuya sede es fija).
  mostrarSede?: boolean
  nombreDeSede?: (sedeId: number) => string
  // Solo el GERENTE edita: además de "Ver turnos" tiene "Editar".
  puedeEditar?: boolean
  ocupada?: boolean
}>()

const emit = defineEmits<{ editar: [cancha: Cancha] }>()

const router = useRouter()

// Convención de las tablas: las acciones de la fila son botones de solo ícono (hasta 2 acciones posibles), en una columna con
// su encabezado "Acciones" y separada del resto por una línea vertical; el nombre es texto simple. Solo la última columna es ajustada (ocupa lo que necesita): las
// demás se reparten el resto del ancho, así Estado y Precio base no quedan empujadas contra el borde derecho.
const columnas = computed<ColumnaTabla[]>(() => [
  { clave: 'tipo', etiqueta: 'Deporte', encabezadoFila: true },
  ...(props.mostrarSede ? [{ clave: 'sede', etiqueta: 'Sede' }] : []),
  { clave: 'estado', etiqueta: 'Estado' },
  { clave: 'costo', etiqueta: 'Precio base por hora' },
  { clave: 'acciones', etiqueta: 'Acciones', conDivisor: true, ajustada: true, alineacion: 'centro' },
])

const claveFila = (fila: Cancha) => fila.id
const sedeDe = (cancha: Cancha) => props.nombreDeSede?.(cancha.sedeId) ?? `Sede ${cancha.sedeId}`
const destinoTurnos = (cancha: Cancha) => ({
  name: 'cancha-turnos',
  params: { canchaId: cancha.id },
  query: props.parametrosDetalle,
})

const maximoDeAcciones = computed(() => (props.puedeEditar ? 2 : 1))

function accionesDe(cancha: Cancha): AccionFilaFz[] {
  const nombre = nombreDeCancha(cancha)
  return [
    { clave: 'ver-turnos', etiqueta: 'Ver turnos', etiquetaAccesible: `Ver turnos de ${nombre}`, icono: 'reloj' },
    ...(props.puedeEditar
      ? [{ clave: 'editar', etiqueta: 'Editar', etiquetaAccesible: `Editar ${nombre}`, icono: 'editar' as const }]
      : []),
  ]
}

function alSeleccionar(cancha: Cancha, clave: string) {
  if (clave === 'ver-turnos') void router.push(destinoTurnos(cancha))
  else if (clave === 'editar') emit('editar', cancha)
}
</script>

<template>
  <TablaFz titulo="Canchas" ocultar-titulo :columnas="columnas" :filas="canchas" :clave-fila="claveFila" :ocupada="ocupada">
    <template #celda-tipo="{ fila }">
      <span class="lista-canchas__nombre">{{ ETIQUETA_TIPO_CANCHA[fila.tipo] }}</span>
      <span class="lista-canchas__id"> #{{ fila.id }}</span>
    </template>
    <template #celda-sede="{ fila }">{{ sedeDe(fila) }}</template>
    <template #celda-estado="{ fila }">
      <InsigniaFz :variante="fila.estado === 'OPERATIVA' ? 'exito' : 'advertencia'">
        {{ ETIQUETA_ESTADO_CANCHA[fila.estado] }}
      </InsigniaFz>
    </template>
    <template #celda-costo="{ fila }">{{ formatearMonto(fila.costoPorHora) }}</template>
    <template #celda-acciones="{ fila }">
      <AccionesFilaFz
        :etiqueta="`Acciones de ${nombreDeCancha(fila)}`"
        :identificador="identificadorDeAccionesCancha(fila.id)"
        :acciones="accionesDe(fila)"
        :maximo="maximoDeAcciones"
        @seleccionar="(clave) => alSeleccionar(fila, clave)"
      />
    </template>
  </TablaFz>
</template>

<style scoped>
.lista-canchas__nombre {
  font-weight: var(--fz-peso-enfasis);
}

.lista-canchas__id {
  color: var(--fz-color-texto-suave);
}
</style>
