<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { BotonFz, CampoTextoFz, ModalFz, TablaFz, type ColumnaTabla } from '@/ui'
import type { Ingreso } from '../services/servicioAcceso'

const props = defineProps<{
  personas: Ingreso[]
  cargando: boolean
  egresandoId: number | null
}>()

const emit = defineEmits<{
  (e: 'egresar', ingresoId: number): void
  (e: 'actualizar'): void
}>()

// Filtro rápido por nombre o DNI
const filtroTexto = ref('')

const personasFiltradas = computed(() => {
  const query = filtroTexto.value.trim().toLowerCase()
  if (!query) return props.personas
  return props.personas.filter((p) =>
    p.nombre.toLowerCase().includes(query) || p.dni.includes(query)
  )
})

const columnas: ColumnaTabla[] = [
  { clave: 'socio', etiqueta: 'Socio / Nombre', encabezadoFila: true },
  { clave: 'dni', etiqueta: 'DNI' },
  { clave: 'ingreso', etiqueta: 'Hora de ingreso' },
  { clave: 'acciones', etiqueta: 'Acciones' },
]

const claveFila = (fila: Ingreso) => fila.id

const modalAbierto = ref(false)
const personaAEgresar = ref<Ingreso | null>(null)

function confirmarEgreso(persona: Ingreso) {
  personaAEgresar.value = persona
  modalAbierto.value = true
}

function cancelarModal() {
  modalAbierto.value = false
  personaAEgresar.value = null
}

function ejecutarEgreso() {
  if (personaAEgresar.value) {
    emit('egresar', personaAEgresar.value.id)
  }
  modalAbierto.value = false
}

function formatearHora(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="tabla-personas-dentro">
    <!-- Barra de búsqueda rápida e integración de controles -->
    <div v-if="personas.length > 0" class="tabla-personas-dentro__toolbar">
      <div class="tabla-personas-dentro__busqueda">
        <CampoTextoFz
          v-model="filtroTexto"
          tipo="search"
          tamano="sm"
          placeholder="Filtrar por nombre o DNI…"
          aria-label="Filtrar socios dentro"
        />
      </div>

      <div class="tabla-personas-dentro__acciones-toolbar">
        <span class="tabla-personas-dentro__conteo">
          Mostrando {{ personasFiltradas.length }} de {{ personas.length }}
        </span>
        <BotonFz
          variante="secundario"
          tamano="sm"
          :cargando="cargando"
          :disabled="cargando"
          @click="emit('actualizar')"
        >
          Actualizar lista
        </BotonFz>
      </div>
    </div>

    <!-- Empty State Dedicado cuando personas está vacío -->
    <div v-if="personas.length === 0 && !cargando" class="tabla-personas-dentro__vacio">
      <div class="tabla-personas-dentro__vacio-icono" aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <h3 class="tabla-personas-dentro__vacio-titulo">
        No hay socios dentro de las instalaciones en este momento
      </h3>
      <p class="tabla-personas-dentro__vacio-descripcion">
        Los ingresos validados en el puesto de acceso aparecerán listados aquí para registrar sus egresos.
      </p>
      <RouterLink to="/acceso/ingreso">
        <BotonFz variante="primario" tamano="sm">
          + Registrar primer ingreso
        </BotonFz>
      </RouterLink>
    </div>

    <!-- Si se filtró y no coincide nada -->
    <div v-else-if="personasFiltradas.length === 0 && !cargando" class="tabla-personas-dentro__sin-resultados">
      <p>No se encontraron socios que coincidan con "<strong>{{ filtroTexto }}</strong>".</p>
      <BotonFz variante="fantasma" tamano="sm" @click="filtroTexto = ''">Limpiar búsqueda</BotonFz>
    </div>

    <!-- Tabla cuando hay datos -->
    <TablaFz
      v-else
      titulo="Socios en la sede"
      ocultar-titulo
      :columnas="columnas"
      :filas="personasFiltradas"
      :clave-fila="claveFila"
      :ocupada="cargando"
      texto-vacio=""
    >
      <template #celda-socio="{ fila }">
        <div class="tabla-personas-dentro__socio">
          <strong>{{ (fila as Ingreso).nombre }}</strong>
          <span class="tabla-personas-dentro__subtexto">ID Socio: {{ (fila as Ingreso).socioId }}</span>
        </div>
      </template>

      <template #celda-dni="{ fila }">
        <span>{{ (fila as Ingreso).dni }}</span>
      </template>

      <template #celda-ingreso="{ fila }">
        <span>{{ formatearHora((fila as Ingreso).fechaHoraIngreso) }}</span>
      </template>

      <template #celda-acciones="{ fila }">
        <BotonFz
          variante="secundario"
          tamano="sm"
          :disabled="egresandoId === (fila as Ingreso).id"
          @click="confirmarEgreso(fila as Ingreso)"
        >
          {{ egresandoId === (fila as Ingreso).id ? 'Egresando…' : 'Registrar egreso' }}
        </BotonFz>
      </template>
    </TablaFz>

    <!-- Modal de confirmación -->
    <ModalFz
      v-model="modalAbierto"
      titulo="Confirmar egreso de socio"
      :ocupado="egresandoId !== null"
    >
      <p v-if="personaAEgresar" class="tabla-personas-dentro__modal-texto">
        ¿Desea registrar la salida de <strong>{{ personaAEgresar.nombre }}</strong> (DNI {{ personaAEgresar.dni }}) de la sede? Esto liberará 1 lugar en el aforo.
      </p>

      <template #acciones="{ cerrar }">
        <BotonFz variante="secundario" :disabled="egresandoId !== null" @click="cancelarModal">
          Volver
        </BotonFz>
        <BotonFz
          variante="primario"
          :cargando="egresandoId !== null"
          :disabled="egresandoId !== null"
          @click="ejecutarEgreso"
        >
          Registrar egreso
        </BotonFz>
      </template>
    </ModalFz>
  </div>
</template>

<style scoped>
.tabla-personas-dentro {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tabla-personas-dentro__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.tabla-personas-dentro__busqueda {
  min-width: 15rem;
}

.tabla-personas-dentro__acciones-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tabla-personas-dentro__conteo {
  font-size: 0.8125rem;
  color: var(--fz-color-texto-suave);
}

.tabla-personas-dentro__socio {
  display: flex;
  flex-direction: column;
}

.tabla-personas-dentro__subtexto {
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}

/* Empty State */
.tabla-personas-dentro__vacio {
  background: var(--fz-color-superficie);
  border: 1px dashed var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  padding: 3rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.75rem;
}

.tabla-personas-dentro__vacio-icono {
  color: var(--fz-color-texto-suave);
  opacity: 0.6;
  margin-bottom: 0.25rem;
}

.tabla-personas-dentro__vacio-titulo {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--fz-color-texto);
}

.tabla-personas-dentro__vacio-descripcion {
  margin: 0 0 0.5rem;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
  max-width: 28rem;
}

.tabla-personas-dentro__sin-resultados {
  background: var(--fz-color-superficie);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-control);
  padding: 2rem;
  text-align: center;
  color: var(--fz-color-texto-suave);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.tabla-personas-dentro__modal-texto {
  margin: 0;
  font-size: var(--fz-texto-cuerpo);
  color: var(--fz-color-texto);
}
</style>
