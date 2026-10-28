<script setup lang="ts">
import { AccionesFilaFz, AvatarFz, InsigniaFz, InterruptorFz, TablaFz, type AccionFilaFz, type ColumnaTabla } from '@/ui'
import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_PLAN,
  VARIANTES_ESTADO,
  accionesDeMenuSocio,
  esAccionFila,
  formatearFecha,
} from '../presentacion'
import type { EstadoMembresia } from '../services/servicioSocios'
import type { AccionFila, FilaSocio } from '../tipos'

defineProps<{
  filas: FilaSocio[]
  nombreSede: (sedeId: number) => string
  ocupada?: boolean
  // Socios cuya renovación automática se está guardando: su interruptor queda ocupado.
  guardandoRenovacion: ReadonlySet<number>
}>()

const emit = defineEmits<{
  'alternar-renovacion': [socioId: number]
  'abrir-accion': [pedido: { socioId: number; accion: AccionFila }]
}>()

const columnas: ColumnaTabla[] = [
  { clave: 'socio', etiqueta: 'Socio', encabezadoFila: true },
  { clave: 'sede', etiqueta: 'Sede', ajustada: true },
  { clave: 'alta', etiqueta: 'Fecha de alta', ajustada: true },
  { clave: 'plan', etiqueta: 'Plan', ajustada: true },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
  { clave: 'renovacion', etiqueta: 'Renovación automática', ajustada: true, alineacion: 'centro', encabezadoEnLineas: true },
  { clave: 'acciones', etiqueta: 'Acciones', conDivisor: true, ajustada: true, alineacion: 'centro' },
]

const claveFila = (fila: FilaSocio) => fila.socio.id

function estadoDe(fila: FilaSocio): EstadoMembresia | null {
  return fila.membresia.situacion === 'disponible' ? fila.membresia.membresia.estado : null
}

// Ver ficha, Cambiar plan, Suspender o Reactivar, y Dejar de ser socio: hasta 4 acciones posibles, así que van todas en el menú
// "···" (con 3 o más, `AccionesFilaFz` usa el menú). Es el mismo contenido que el de la ficha (accionesDeMenuSocio): sin
// membresía disponible, estado = null.
const MAXIMO_DE_ACCIONES = 4

const accionesDe = (fila: FilaSocio): AccionFilaFz[] =>
  accionesDeMenuSocio(estadoDe(fila), 'lista').map((accion) => ({ ...accion, icono: accion.icono ?? 'acciones' }))

function alSeleccionar(fila: FilaSocio, clave: string) {
  if (esAccionFila(clave)) emit('abrir-accion', { socioId: fila.socio.id, accion: clave })
}
</script>

<template>
  <TablaFz
    titulo="Listado de socios"
    ocultar-titulo
    :columnas="columnas"
    :filas="filas"
    :clave-fila="claveFila"
    :ocupada="ocupada"
  >
    <template #celda-socio="{ fila }">
      <div class="socio">
        <AvatarFz :nombre="fila.socio.nombre" />
        <div class="socio__datos">
          <div class="socio__linea">
            <span class="socio__nombre">{{ fila.socio.nombre }}</span>
            <span class="socio__id" title="ID de socio para registrar accesos">#{{ fila.socio.id }}</span>
          </div>
          <span class="socio__email" :title="fila.socio.email">{{ fila.socio.email }}</span>
        </div>
      </div>
    </template>

    <template #celda-sede="{ fila }">
      {{ nombreSede(fila.socio.sedeOrigenId) }}
    </template>

    <template #celda-alta="{ fila }">
      <span class="tenue">{{ formatearFecha(fila.socio.fechaAlta) }}</span>
    </template>

    <template #celda-plan="{ fila }">
      <InsigniaFz v-if="fila.membresia.situacion === 'disponible'">
        {{ ETIQUETAS_PLAN[fila.membresia.membresia.plan] }}
      </InsigniaFz>
      <span v-else class="tenue">{{ fila.membresia.situacion === 'cargando' ? 'Cargando…' : 'Sin plan' }}</span>
    </template>

    <template #celda-estado="{ fila }">
      <InsigniaFz
        v-if="fila.membresia.situacion === 'disponible'"
        :variante="VARIANTES_ESTADO[fila.membresia.membresia.estado]"
      >
        {{ ETIQUETAS_ESTADO[fila.membresia.membresia.estado] }}
      </InsigniaFz>
      <span v-else class="tenue">{{ fila.membresia.situacion === 'cargando' ? 'Cargando…' : '—' }}</span>
    </template>

    <template #celda-renovacion="{ fila }">
      <InterruptorFz
        v-if="fila.membresia.situacion === 'disponible'"
        :model-value="fila.membresia.membresia.renuevaAutomatica"
        :etiqueta="`Renovación automática de ${fila.socio.nombre}`"
        :ocupado="guardandoRenovacion.has(fila.socio.id)"
        @update:model-value="emit('alternar-renovacion', fila.socio.id)"
      />
      <span v-else class="tenue">{{ fila.membresia.situacion === 'cargando' ? 'Cargando…' : '—' }}</span>
    </template>

    <template #celda-acciones="{ fila }">
      <AccionesFilaFz
        :etiqueta="`Acciones de ${fila.socio.nombre}`"
        :identificador="`menu-socio-${fila.socio.id}`"
        :acciones="accionesDe(fila)"
        :maximo="MAXIMO_DE_ACCIONES"
        @seleccionar="(clave) => alSeleccionar(fila, clave)"
      />
    </template>
  </TablaFz>
</template>

<style scoped>
.socio {
  display: flex;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.socio__datos {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: calc(15 * var(--fz-espaciado-base));
}

.socio__linea {
  display: flex;
  align-items: baseline;
  gap: var(--fz-espaciado-compacto);
}

.socio__nombre {
  color: var(--fz-color-texto);
  font-weight: var(--fz-peso-enfasis);
}

.socio__id,
.socio__email {
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-minimo);
  font-weight: var(--fz-peso-normal);
}

.socio__email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tenue {
  color: var(--fz-color-texto-suave);
}
</style>
