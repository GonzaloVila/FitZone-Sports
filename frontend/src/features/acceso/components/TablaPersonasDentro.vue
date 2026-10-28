<script setup lang="ts">
import { computed, ref } from 'vue'
import { AccionesFilaFz, AvatarFz, BotonFz, CampoTextoFz, ModalFz, TablaFz, type AccionFilaFz, type ColumnaTabla } from '@/ui'
import type { Ingreso } from '../services/servicioAcceso'

const props = defineProps<{
  personas: Ingreso[]
  cargando: boolean
  egresandoId: number | null
}>()

const emit = defineEmits<{
  (e: 'egresar', ingresoId: number): void
  (e: 'actualizar'): void
  // La pantalla abre el modal de registro de ingreso (el foco vuelve a este botón al cerrarlo).
  (e: 'registrar-ingreso'): void
}>()

// Filtro rápido por nombre o DNI
const filtroTexto = ref('')

const personasFiltradas = computed(() => {
  const query = filtroTexto.value.trim().toLowerCase()
  if (!query) return props.personas
  return props.personas.filter((p) => p.nombre.toLowerCase().includes(query) || p.dni.includes(query))
})

const columnas: ColumnaTabla[] = [
  { clave: 'socio', etiqueta: 'Socio', encabezadoFila: true },
  { clave: 'dni', etiqueta: 'DNI', ajustada: true },
  { clave: 'ingreso', etiqueta: 'Hora de ingreso', ajustada: true },
  { clave: 'acciones', etiqueta: 'Acciones', etiquetaOculta: true, ajustada: true, alineacion: 'fin' },
]

// Una sola acción por fila ("Registrar egreso"): es un ícono. Mientras se registra, muestra el estado de carga.
const MAXIMO_DE_ACCIONES = 1

const accionesDe = (persona: Ingreso): AccionFilaFz[] => [
  {
    clave: 'egresar',
    etiqueta: 'Registrar egreso',
    etiquetaAccesible: `Registrar egreso de ${persona.nombre}`,
    icono: 'salida',
    cargando: props.egresandoId === persona.id,
  },
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
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? iso : fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="personas">
    <template v-if="personas.length > 0">
      <div class="personas__barra">
        <div class="personas__busqueda">
          <CampoTextoFz
            v-model="filtroTexto"
            tipo="search"
            icono="buscar"
            name="filtro"
            autocomplete="off"
            placeholder="Filtrar por nombre o DNI…"
            aria-label="Filtrar los socios que están dentro"
          />
        </div>
        <span class="personas__conteo" role="status" aria-live="polite">
          Mostrando {{ personasFiltradas.length }} de {{ personas.length }}
        </span>
        <BotonFz variante="secundario" :cargando="cargando" :disabled="cargando" @click="emit('actualizar')">
          Actualizar
        </BotonFz>
      </div>

      <div v-if="personasFiltradas.length === 0 && !cargando" class="personas__estado">
        <p class="personas__texto">No hay socios que coincidan con "{{ filtroTexto }}".</p>
        <BotonFz variante="fantasma" @click="filtroTexto = ''">Limpiar búsqueda</BotonFz>
      </div>

      <TablaFz
        v-else
        titulo="Socios en la sede"
        ocultar-titulo
        :columnas="columnas"
        :filas="personasFiltradas"
        :clave-fila="claveFila"
        :ocupada="cargando"
      >
        <template #celda-socio="{ fila }">
          <div class="socio">
            <AvatarFz :nombre="(fila as Ingreso).nombre" />
            <div class="socio__datos">
              <span class="socio__nombre">{{ (fila as Ingreso).nombre }}</span>
              <span class="socio__id" title="ID de socio">#{{ (fila as Ingreso).socioId }}</span>
            </div>
          </div>
        </template>

        <template #celda-dni="{ fila }">{{ (fila as Ingreso).dni }}</template>

        <template #celda-ingreso="{ fila }">
          <span class="tenue">{{ formatearHora((fila as Ingreso).fechaHoraIngreso) }}</span>
        </template>

        <template #celda-acciones="{ fila }">
          <AccionesFilaFz
            :etiqueta="`Acciones de ${(fila as Ingreso).nombre}`"
            :identificador="`acciones-ingreso-${(fila as Ingreso).id}`"
            :acciones="accionesDe(fila as Ingreso)"
            :maximo="MAXIMO_DE_ACCIONES"
            @seleccionar="confirmarEgreso(fila as Ingreso)"
          />
        </template>
      </TablaFz>
    </template>

    <p v-else-if="cargando" class="personas__texto" role="status">Cargando los socios que están dentro…</p>

    <div v-else class="personas__estado">
      <p class="personas__texto">No hay socios dentro de la sede en este momento.</p>
      <BotonFz variante="secundario" @click="emit('registrar-ingreso')">Registrar ingreso</BotonFz>
    </div>

    <ModalFz
      v-model="modalAbierto"
      titulo="Registrar egreso"
      icono="cerrar-sesion"
      ancho="angosto"
      :ocupado="egresandoId !== null"
    >
      <p v-if="personaAEgresar" class="personas__texto personas__texto--normal">
        ¿Registrar la salida de <strong>{{ personaAEgresar.nombre }}</strong> (DNI {{ personaAEgresar.dni }})? Se libera un lugar en el aforo.
      </p>

      <template #acciones>
        <BotonFz variante="secundario" :disabled="egresandoId !== null" @click="cancelarModal">Cancelar</BotonFz>
        <BotonFz :cargando="egresandoId !== null" :disabled="egresandoId !== null" @click="ejecutarEgreso">
          Registrar egreso
        </BotonFz>
      </template>
    </ModalFz>
  </div>
</template>

<style scoped>
.personas {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.personas__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

/* El buscador se estira; el conteo y el botón quedan a la derecha. */
.personas__busqueda {
  flex: 1 1 calc(10 * var(--fz-espaciado-amplio));
  min-width: 0;
}

.personas__conteo {
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.personas__estado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-base);
  padding: var(--fz-espaciado-base) 0;
}

.personas__texto {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.personas__texto--normal {
  color: var(--fz-color-texto);
  font-size: var(--fz-texto-cuerpo);
}

.socio {
  display: flex;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.socio__datos {
  display: flex;
  align-items: baseline;
  gap: var(--fz-espaciado-compacto);
  min-width: 0;
}

.socio__nombre {
  color: var(--fz-color-texto);
  font-weight: var(--fz-peso-enfasis);
}

.socio__id,
.tenue {
  color: var(--fz-color-texto-suave);
}

.socio__id {
  font-size: var(--fz-texto-minimo);
  font-weight: var(--fz-peso-normal);
}
</style>
