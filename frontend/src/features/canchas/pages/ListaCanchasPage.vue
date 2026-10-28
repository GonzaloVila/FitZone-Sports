<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useSedeActiva } from '@/compartido/composables/useSedeActiva'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import {
  AvisoFz,
  BotonFz,
  EncabezadoPaginaFz,
  IconoFz,
  InsigniaFz,
  PaginacionFz,
  SelectorSegmentadoFz,
  type OpcionSegmentadaFz,
} from '@/ui'
import FiltrosCanchas from '../components/FiltrosCanchas.vue'
import ListaCanchas from '../components/ListaCanchas.vue'
import ModalEditarCancha from '../components/modales/ModalEditarCancha.vue'
import ModalNuevaCancha from '../components/modales/ModalNuevaCancha.vue'
import VistaMisReservas from '../components/VistaMisReservas.vue'
import { POR_PAGINA_CANCHAS, useCanchas } from '../composables/useCanchas'
import { useVistaCanchas } from '../composables/useVistaCanchas'
import { puedeReservar } from '../reglas'
import type { Cancha } from '../services/servicioCanchas'

const { rol, sedeId: sedeUsuario } = useUsuarioSesion()
const { sedes, cargando: cargandoSedes, error: errorSedes, nombreDeSede } = useSedes()

const reserva = computed(() => puedeReservar(rol.value))
const esGerente = computed(() => rol.value === 'GERENTE')

// "Mis reservas" es una vista más de esta pantalla, solo para quien reserva (SOCIO y EXTERNO); la vista activa vive en la
// dirección.
const { vista } = useVistaCanchas(reserva)
const enCanchas = computed(() => vista.value === 'canchas')
const opcionesVista: OpcionSegmentadaFz[] = [
  { valor: 'canchas', etiqueta: 'Canchas' },
  { valor: 'mis-reservas', etiqueta: 'Mis reservas' },
]
const subtitulo = computed(() => {
  if (!enCanchas.value) return 'Tus reservas de cancha, con la opción de pagar o cancelar.'
  if (esGerente.value) return 'Las canchas de cada sede: cargá nuevas, editá su costo y estado, y mirá sus turnos.'
  return reserva.value
    ? 'Elegí una cancha para ver sus turnos y reservar.'
    : 'Consultá las canchas y la disponibilidad de sus turnos.'
})

function cambiarVista(valor: string) {
  vista.value = valor === 'mis-reservas' ? 'mis-reservas' : 'canchas'
}

// El filtro de sede arranca en "Todas las sedes" (GERENTE, SOCIO y EXTERNO); el RECEPCION con sede en el token ve siempre la
// suya y no tiene selector. Solo un RECEPCION sin sede en el token mantiene lo de antes: arranca en la sede activa y puede
// cambiarla.
const sedeFija = computed(() => sedeUsuario.value !== null)
const sedeActiva = useSedeActiva(sedes)
const {
  filtros,
  pagina,
  items,
  total,
  totalPaginas,
  cargando,
  error,
  hayFiltrosActivos,
  limpiarFiltros,
  parametrosDetalle,
  recargar,
} = useCanchas(() => (rol.value === 'RECEPCION' && !sedeFija.value ? sedeActiva.value : null))

// La tabla muestra a qué sede pertenece cada cancha con "Todas las sedes" y también cuando la sede es fija (RECEPCION con
// sede en el token: no tiene selector, pero igual ve en qué sede está cada fila).
const mostrarSede = computed(() => filtros.sede === '' || sedeFija.value)

// La lista no se actualiza mientras se mira "Mis reservas": al volver se trae de nuevo.
watch(enCanchas, (visible) => {
  if (visible) void recargar()
})

const altaAbierta = ref(false)
const edicionAbierta = ref(false)
const canchaEnEdicion = ref<Cancha | null>(null)

function editar(cancha: Cancha) {
  canchaEnEdicion.value = cancha
  edicionAbierta.value = true
}

// Al cerrarse el modal de edición (Cancelar, X, Esc o éxito) el foco vuelve al botón "···" de esa fila: el ítem del menú
// que lo abrió ya no existe. Se espera a que el modal termine de cerrarse para que su propia devolución de foco no pise esta.
watch(edicionAbierta, async (abierta) => {
  if (abierta || !canchaEnEdicion.value) return
  const identificador = `menu-cancha-${canchaEnEdicion.value.id}`
  await nextTick()
  document.querySelector<HTMLElement>(`[data-identificador="${identificador}"]`)?.focus()
})

const hayFilas = computed(() => items.value.length > 0)
const cargandoSinFilas = computed(() => cargando.value && !hayFilas.value)
const vacio = computed(() => !cargando.value && !hayFilas.value && !error.value)

const rangoInicio = computed(() => (total.value === 0 ? 0 : (pagina.value - 1) * POR_PAGINA_CANCHAS + 1))
const rangoFin = computed(() => Math.min(total.value, pagina.value * POR_PAGINA_CANCHAS))

// La región del pie siempre está en el DOM (los lectores de pantalla solo anuncian cambios de una región existente);
// mientras no hay un resultado que informar, queda vacía.
const textoRango = computed(() => {
  if (cargandoSinFilas.value || error.value) return ''
  if (total.value === 0) return '0 canchas'
  return `Mostrando ${rangoInicio.value} a ${rangoFin.value} de ${total.value} ${total.value === 1 ? 'cancha' : 'canchas'}`
})
</script>

<template>
  <section class="canchas">
    <EncabezadoPaginaFz titulo="Canchas" :subtitulo="subtitulo">
      <template v-if="enCanchas" #insignia>
        <InsigniaFz>{{ total }} {{ total === 1 ? 'cancha' : 'canchas' }}</InsigniaFz>
      </template>
    </EncabezadoPaginaFz>

    <div v-if="reserva" class="canchas__vistas">
      <SelectorSegmentadoFz
        :model-value="vista"
        nombre="vista-canchas"
        leyenda="Vista de canchas"
        :opciones="opcionesVista"
        @update:model-value="cambiarVista"
      />
    </div>

    <VistaMisReservas v-if="!enCanchas" />

    <template v-else>
      <FiltrosCanchas
        v-model:tipo="filtros.tipo"
        v-model:sede="filtros.sede"
        v-model:estado="filtros.estado"
        :sedes="sedes"
        :cargando-sedes="cargandoSedes"
        :sede-fija="sedeFija"
        :hay-filtros-activos="hayFiltrosActivos"
        @limpiar="limpiarFiltros"
      >
        <template v-if="esGerente" #acciones>
          <BotonFz @click="altaAbierta = true">
            <IconoFz nombre="mas" tamano="sm" />
            Nueva cancha
          </BotonFz>
        </template>
      </FiltrosCanchas>

      <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
      <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

      <ListaCanchas
        v-if="hayFilas"
        :canchas="items"
        :parametros-detalle="parametrosDetalle"
        :mostrar-sede="mostrarSede"
        :nombre-de-sede="nombreDeSede"
        :puede-editar="esGerente"
        :ocupada="cargando"
        @editar="editar"
      />

      <p v-else-if="cargandoSinFilas" class="canchas__estado" role="status">Cargando canchas…</p>

      <p v-else-if="vacio" class="canchas__estado canchas__vacio" role="status">
        No se encontraron canchas con los filtros elegidos. Probá con otro deporte, sede o estado.
      </p>

      <footer class="canchas__pie">
        <p class="canchas__rango" role="status" aria-live="polite" aria-atomic="true">{{ textoRango }}</p>
        <PaginacionFz v-if="totalPaginas > 1" v-model="pagina" :total-paginas="totalPaginas" etiqueta="Paginación de canchas" />
      </footer>
    </template>

    <template v-if="esGerente">
      <ModalNuevaCancha v-model:abierto="altaAbierta" :sedes="sedes" @creada="recargar" />
      <ModalEditarCancha v-model:abierto="edicionAbierta" :sedes="sedes" :cancha="canchaEnEdicion" @guardada="recargar" />
    </template>
  </section>
</template>

<style scoped>
.canchas {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

/* El selector mide lo que sus dos opciones; en ancho chico ocupa todo el ancho disponible. */
.canchas__vistas {
  width: calc(10 * var(--fz-espaciado-amplio));
  max-width: 100%;
}

.canchas__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.canchas__vacio {
  padding: var(--fz-espaciado-amplio) 0;
}

.canchas__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.canchas__rango {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
