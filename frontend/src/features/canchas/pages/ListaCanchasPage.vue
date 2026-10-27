<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
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
import VistaMisReservas from '../components/VistaMisReservas.vue'
import { POR_PAGINA_CANCHAS, useCanchas } from '../composables/useCanchas'
import { useVistaCanchas } from '../composables/useVistaCanchas'
import { puedeReservar } from '../reglas'

const { rol, sedeId: sedeUsuario } = useUsuarioSesion()
const { sedes, cargando: cargandoSedes, error: errorSedes } = useSedes()

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
  return reserva.value
    ? 'Elegí una sede y una cancha para ver sus turnos y reservar.'
    : 'Consultá las canchas de cada sede y la disponibilidad de sus turnos.'
})

function cambiarVista(valor: string) {
  vista.value = valor === 'mis-reservas' ? 'mis-reservas' : 'canchas'
}

// La sede activa se comparte con las otras pantallas de trabajo; el RECEPCION trabaja siempre en la suya. La lista arranca
// ahí, y elegir otra sede en el filtro no cambia la sede activa.
const sedeActiva = useSedeActiva(sedes, () => (esGerente.value ? null : sedeUsuario.value))
const { filtros, pagina, items, total, totalPaginas, cargando, error, parametrosDetalle, recargar } = useCanchas(sedeActiva)

// La lista no se actualiza mientras se mira "Mis reservas": al volver se trae de nuevo.
watch(enCanchas, (visible) => {
  if (visible) void recargar()
})

const hayFilas = computed(() => items.value.length > 0)
const cargandoSinFilas = computed(() => cargando.value && !hayFilas.value)
const vacio = computed(() => !cargando.value && !hayFilas.value && !error.value)

const rangoInicio = computed(() => (total.value === 0 ? 0 : (pagina.value - 1) * POR_PAGINA_CANCHAS + 1))
const rangoFin = computed(() => Math.min(total.value, pagina.value * POR_PAGINA_CANCHAS))

// La región del pie siempre está en el DOM (los lectores de pantalla solo anuncian cambios de una región existente);
// mientras no hay un resultado que informar, queda vacía.
const textoRango = computed(() => {
  if (cargandoSinFilas.value || error.value || !filtros.sede) return ''
  if (total.value === 0) return '0 canchas'
  return `Mostrando ${rangoInicio.value} a ${rangoFin.value} de ${total.value} ${total.value === 1 ? 'cancha' : 'canchas'}`
})
</script>

<template>
  <section class="canchas">
    <EncabezadoPaginaFz titulo="Canchas" :subtitulo="subtitulo">
      <template v-if="enCanchas && filtros.sede" #insignia>
        <InsigniaFz>{{ total }} {{ total === 1 ? 'cancha' : 'canchas' }}</InsigniaFz>
      </template>
      <template v-if="esGerente && enCanchas" #acciones>
        <RouterLink v-slot="{ href, navigate }" :to="{ name: 'canchas-gestion' }" custom>
          <BotonFz como="a" variante="secundario" :href="href" @click="navigate">
            <IconoFz nombre="editar" tamano="sm" />
            Gestionar canchas
          </BotonFz>
        </RouterLink>
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
      <FiltrosCanchas v-model:sede="filtros.sede" v-model:estado="filtros.estado" :sedes="sedes" :cargando-sedes="cargandoSedes" />

      <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
      <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

      <ListaCanchas v-if="hayFilas" :canchas="items" :parametros-detalle="parametrosDetalle" :ocupada="cargando" />

      <p v-else-if="cargandoSinFilas" class="canchas__estado" role="status">Cargando canchas…</p>

      <p v-else-if="vacio" class="canchas__estado canchas__vacio" role="status">
        {{
          filtros.sede
            ? 'No se encontraron canchas con los filtros elegidos. Probá con otra sede o con otro estado.'
            : 'Elegí una sede para ver sus canchas.'
        }}
      </p>

      <footer class="canchas__pie">
        <p class="canchas__rango" role="status" aria-live="polite" aria-atomic="true">{{ textoRango }}</p>
        <PaginacionFz v-if="totalPaginas > 1" v-model="pagina" :total-paginas="totalPaginas" etiqueta="Paginación de canchas" />
      </footer>
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
