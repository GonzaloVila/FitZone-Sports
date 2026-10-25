<script setup lang="ts">
import { RouterLink } from 'vue-router'
import {
  AvatarFz,
  InsigniaFz,
  InterruptorFz,
  MenuAccionesFz,
  TablaFz,
  type AccionMenuFz,
  type ColumnaTabla,
} from '@/ui'
import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_PLAN,
  VARIANTES_ESTADO,
  accionPermitida,
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
  { clave: 'acciones', etiqueta: 'Acciones', ajustada: true, alineacion: 'fin' },
]

const claveFila = (fila: FilaSocio) => fila.socio.id

function estadoDe(fila: FilaSocio): EstadoMembresia | null {
  return fila.membresia.situacion === 'disponible' ? fila.membresia.membresia.estado : null
}

// Las reglas de habilitación son las de la ficha (accionPermitida): sin membresía disponible, estado = null.
function accionesDe(fila: FilaSocio): AccionMenuFz[] {
  const estado = estadoDe(fila)
  const alternaEstado: AccionMenuFz =
    estado === 'SUSPENDIDA'
      ? { clave: 'reactivar', etiqueta: 'Reactivar', icono: 'reproducir', deshabilitada: !accionPermitida('reactivar', estado) }
      : { clave: 'suspender', etiqueta: 'Suspender', icono: 'pausa', deshabilitada: !accionPermitida('suspender', estado) }
  return [
    { clave: 'ver-ficha', etiqueta: 'Ver ficha', icono: 'ojo' },
    { clave: 'cambiar-plan', etiqueta: 'Cambiar plan', icono: 'cambiar', deshabilitada: !accionPermitida('cambiar-plan', estado) },
    alternaEstado,
    { clave: 'dejar-de-ser-socio', etiqueta: 'Dejar de ser socio', icono: 'quitar-usuario', peligro: true },
  ]
}

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
            <RouterLink :to="{ name: 'socio-detalle', params: { socioId: fila.socio.id } }" class="socio__nombre">
              {{ fila.socio.nombre }}
            </RouterLink>
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
      <MenuAccionesFz
        :etiqueta="`Acciones de ${fila.socio.nombre}`"
        :acciones="accionesDe(fila)"
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
  text-decoration: none;
}

.socio__nombre:hover {
  text-decoration: underline;
}

.socio__nombre:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
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
