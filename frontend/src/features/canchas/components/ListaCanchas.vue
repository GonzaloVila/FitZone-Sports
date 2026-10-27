<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { BotonFz, IconoFz, InsigniaFz, MenuAccionesFz, TablaFz, type AccionMenuFz, type ColumnaTabla } from '@/ui'
import { nombreDeCancha } from '../edicion'
import { ETIQUETA_ESTADO_CANCHA, ETIQUETA_TIPO_CANCHA, formatearMonto } from '../presentacion'
import type { Cancha } from '../services/servicioCanchas'

const props = defineProps<{
  canchas: Cancha[]
  // Parámetros de dirección del enlace a la grilla de turnos (de dónde se vino y con qué filtros).
  parametrosDetalle?: Record<string, string>
  // Con "Todas las sedes" la tabla suma la columna Sede.
  mostrarSede?: boolean
  nombreDeSede?: (sedeId: number) => string
  // Solo el GERENTE edita: tiene dos acciones por fila (Ver turnos y Editar), en un menú. Los demás tienen una sola ("Ver
  // turnos") y va directa, sin menú.
  puedeEditar?: boolean
  ocupada?: boolean
}>()

const emit = defineEmits<{ editar: [cancha: Cancha] }>()

const router = useRouter()

const columnas = computed<ColumnaTabla[]>(() => [
  { clave: 'tipo', etiqueta: 'Deporte', encabezadoFila: true },
  ...(props.mostrarSede ? [{ clave: 'sede', etiqueta: 'Sede' }] : []),
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
  { clave: 'costo', etiqueta: 'Precio base por hora', ajustada: true },
  { clave: 'acciones', etiqueta: 'Acciones', ajustada: true, alineacion: 'fin' },
])

const ACCIONES_GERENTE: AccionMenuFz[] = [
  { clave: 'ver-turnos', etiqueta: 'Ver turnos', icono: 'reloj' },
  { clave: 'editar', etiqueta: 'Editar', icono: 'editar' },
]

const claveFila = (fila: Cancha) => fila.id
const sedeDe = (cancha: Cancha) => props.nombreDeSede?.(cancha.sedeId) ?? `Sede ${cancha.sedeId}`
const destinoTurnos = (cancha: Cancha) => ({
  name: 'cancha-turnos',
  params: { canchaId: cancha.id },
  query: props.parametrosDetalle,
})

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
      <MenuAccionesFz
        v-if="puedeEditar"
        :etiqueta="`Acciones de ${nombreDeCancha(fila)}`"
        :identificador="`menu-cancha-${fila.id}`"
        :acciones="ACCIONES_GERENTE"
        @seleccionar="(clave) => alSeleccionar(fila, clave)"
      />
      <RouterLink v-else v-slot="{ href, navigate }" :to="destinoTurnos(fila)" custom>
        <BotonFz como="a" variante="secundario" tamano="sm" :href="href" :aria-label="`Ver turnos de ${nombreDeCancha(fila)}`" @click="navigate">
          <IconoFz nombre="reloj" tamano="sm" />
          Ver turnos
        </BotonFz>
      </RouterLink>
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
