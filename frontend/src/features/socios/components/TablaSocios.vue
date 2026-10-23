<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { InsigniaFz, TablaFz, type ColumnaTabla } from '@/ui'
import { ETIQUETAS_ESTADO, ETIQUETAS_PLAN, VARIANTES_ESTADO, formatearFecha } from '../presentacion'
import type { FilaSocio } from '../tipos'

defineProps<{
  filas: FilaSocio[]
  nombreSede: (sedeId: number) => string
  ocupada?: boolean
}>()

const columnas: ColumnaTabla[] = [
  { clave: 'socio', etiqueta: 'Socio', encabezadoFila: true },
  { clave: 'sede', etiqueta: 'Sede' },
  { clave: 'alta', etiqueta: 'Fecha de alta' },
  { clave: 'plan', etiqueta: 'Plan' },
  { clave: 'estado', etiqueta: 'Estado' },
  { clave: 'acciones', etiqueta: 'Acciones' },
]

const claveFila = (fila: FilaSocio) => fila.socio.id

// Iniciales del socio para el avatar
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  const p1 = partes[0]
  const p2 = partes[1]
  if (p1 && p2) {
    return `${p1.charAt(0)}${p2.charAt(0)}`.toUpperCase()
  }
  return nombre.slice(0, 2).toUpperCase()
}

// Menú contextual activo por fila
const menuActivoId = ref<number | null>(null)

function alternarMenu(id: number) {
  menuActivoId.value = menuActivoId.value === id ? null : id
}

function cerrarMenu() {
  menuActivoId.value = null
}
</script>

<template>
  <div class="tabla-socios-contenedor">
    <TablaFz
      titulo="Listado de socios"
      ocultar-titulo
      :columnas="columnas"
      :filas="filas"
      :clave-fila="claveFila"
      :ocupada="ocupada"
    >
      <!-- Identidad unificada: Avatar + Nombre + Email -->
      <template #celda-socio="{ fila }">
        <div class="tabla-socios__identidad">
          <div class="tabla-socios__avatar" aria-hidden="true">
            {{ iniciales((fila as FilaSocio).socio.nombre) }}
          </div>
          <div class="tabla-socios__detalles">
            <div class="tabla-socios__fila-nombre">
              <RouterLink
                :to="{ name: 'socio-detalle', params: { socioId: (fila as FilaSocio).socio.id } }"
                class="tabla-socios__nombre-link"
              >
                {{ (fila as FilaSocio).socio.nombre }}
              </RouterLink>
              <span class="tabla-socios__badge-id" title="ID de socio para registrar accesos">
                #{{ (fila as FilaSocio).socio.id }}
              </span>
            </div>
            <span class="tabla-socios__email">{{ (fila as FilaSocio).socio.email }}</span>
          </div>
        </div>
      </template>

      <template #celda-sede="{ fila }">
        <span>{{ nombreSede((fila as FilaSocio).socio.sedeOrigenId) }}</span>
      </template>

      <template #celda-alta="{ fila }">
        <span class="tabla-socios__fecha">{{ formatearFecha((fila as FilaSocio).socio.fechaAlta) }}</span>
      </template>

      <template #celda-plan="{ fila }">
        <InsigniaFz v-if="(fila as FilaSocio).membresia.situacion === 'disponible'">
          {{ ETIQUETAS_PLAN[((fila as FilaSocio).membresia as { situacion: 'disponible'; membresia: { plan: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL' } }).membresia.plan] }}
        </InsigniaFz>
        <span v-else class="tabla-socios__tenue">
          {{ (fila as FilaSocio).membresia.situacion === 'cargando' ? 'Cargando…' : 'Sin plan' }}
        </span>
      </template>

      <template #celda-estado="{ fila }">
        <InsigniaFz
          v-if="(fila as FilaSocio).membresia.situacion === 'disponible'"
          :variante="VARIANTES_ESTADO[((fila as FilaSocio).membresia as { situacion: 'disponible'; membresia: { estado: 'ACTIVA' | 'VENCIDA' | 'SUSPENDIDA' } }).membresia.estado]"
        >
          {{ ETIQUETAS_ESTADO[((fila as FilaSocio).membresia as { situacion: 'disponible'; membresia: { estado: 'ACTIVA' | 'VENCIDA' | 'SUSPENDIDA' } }).membresia.estado] }}
        </InsigniaFz>
        <span v-else class="tabla-socios__tenue">
          {{ (fila as FilaSocio).membresia.situacion === 'cargando' ? 'Cargando…' : '—' }}
        </span>
      </template>

      <!-- Columna de Acciones -->
      <template #celda-acciones="{ fila }">
        <div class="tabla-socios__acciones-fila">
          <RouterLink
            :to="{ name: 'socio-detalle', params: { socioId: (fila as FilaSocio).socio.id } }"
            class="tabla-socios__boton-accion"
            title="Ver ficha detallada"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span class="tabla-socios__accion-texto">Ver</span>
          </RouterLink>

          <!-- Menú de opciones secundarias (tres puntos) -->
          <div class="tabla-socios__menu-contenedor">
            <button
              type="button"
              class="tabla-socios__boton-tres-puntos"
              title="Más opciones"
              aria-label="Más opciones"
              @click="alternarMenu((fila as FilaSocio).socio.id)"
            >
              ···
            </button>

            <div
              v-if="menuActivoId === (fila as FilaSocio).socio.id"
              class="tabla-socios__dropdown"
              @mouseleave="cerrarMenu"
            >
              <RouterLink
                :to="{ name: 'socio-detalle', params: { socioId: (fila as FilaSocio).socio.id } }"
                class="tabla-socios__dropdown-item"
              >
                Modificar membresía
              </RouterLink>
              <RouterLink
                :to="{ name: 'socio-detalle', params: { socioId: (fila as FilaSocio).socio.id } }"
                class="tabla-socios__dropdown-item"
              >
                Ver carnet / QR
              </RouterLink>
            </div>
          </div>
        </div>
      </template>
    </TablaFz>
  </div>
</template>

<style scoped>
.tabla-socios-contenedor {
  width: 100%;
}

.tabla-socios__identidad {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tabla-socios__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--fz-color-hover);
  border: 1px solid var(--fz-color-borde);
  color: var(--fz-color-texto);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
}

.tabla-socios__detalles {
  display: flex;
  flex-direction: column;
}

.tabla-socios__fila-nombre {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.tabla-socios__badge-id {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fz-color-primario);
  background: var(--fz-color-hover);
  border: 1px solid var(--fz-color-borde);
  padding: 0.0625rem 0.375rem;
  border-radius: var(--fz-radio-control);
}

.tabla-socios__nombre-link {
  color: var(--fz-color-texto);
  font-weight: 600;
  text-decoration: none;
  transition: color 0.15s ease;
}

.tabla-socios__nombre-link:hover {
  color: var(--fz-color-primario);
  text-decoration: underline;
}

.tabla-socios__email {
  font-size: 0.75rem;
  color: var(--fz-color-texto-suave);
}

.tabla-socios__fecha {
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}

.tabla-socios__tenue {
  color: var(--fz-color-texto-suave);
  font-size: 0.8125rem;
}

.tabla-socios__acciones-fila {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
}

.tabla-socios__boton-accion {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--fz-radio-control);
  background: var(--fz-color-hover);
  border: 1px solid var(--fz-color-borde);
  color: var(--fz-color-texto);
  font-size: 0.75rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s ease;
}

.tabla-socios__boton-accion:hover {
  background: var(--fz-color-borde);
}

.tabla-socios__accion-texto {
  font-size: 0.75rem;
}

.tabla-socios__menu-contenedor {
  position: relative;
}

.tabla-socios__boton-tres-puntos {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--fz-radio-control);
  color: var(--fz-color-texto-suave);
  font-size: 1.125rem;
  font-weight: bold;
  padding: 0 0.375rem;
  cursor: pointer;
  line-height: 1;
  transition: background 0.15s ease;
}

.tabla-socios__boton-tres-puntos:hover {
  background: var(--fz-color-hover);
  border-color: var(--fz-color-borde);
  color: var(--fz-color-texto);
}

.tabla-socios__dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 0.25rem;
  background: var(--fz-color-superficie);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-control);
  box-shadow: var(--fz-sombra-elevada);
  display: flex;
  flex-direction: column;
  min-width: 10rem;
  z-index: 10;
  padding: 0.25rem 0;
}

.tabla-socios__dropdown-item {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--fz-color-texto);
  text-decoration: none;
  transition: background 0.15s;
}

.tabla-socios__dropdown-item:hover {
  background: var(--fz-color-hover);
  color: var(--fz-color-primario);
}
</style>
