<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { textoDeRango } from '@/compartido/paginacion'
import { useServicios } from '@/compartido/servicios'
import { AvisoFz, EncabezadoPaginaFz, InsigniaFz, PaginacionFz, enfocarControlDeFila, useAvisosFz } from '@/ui'
import { useAnularPago } from '../composables/useAnularPago'
import { useDescargaPdf } from '../composables/useDescargaPdf'
import { POR_PAGINA_PAGOS, useListaPagos } from '../composables/useListaPagos'
import type { Pago } from '../services/servicioPagos'
import ConfirmarAnulacion from './ConfirmarAnulacion.vue'
import FiltrosPagos from './FiltrosPagos.vue'
import TablaPagos from './TablaPagos.vue'

// Lo que comparten "Pagos" (el personal ve todos y puede anular) y "Mis pagos" (cada uno ve los suyos y baja sus comprobantes):
// encabezado, filtros, tabla, estados, pie con rango y paginación, y la descarga del comprobante. Las páginas solo deciden
// el título, a quién se acota la lista y si se puede anular.
const props = withDefaults(
  defineProps<{
    titulo: string
    subtitulo: string
    // Acota la lista a un usuario ("Mis pagos"): no se edita ni se ve. `null` es una sesión sin usuario: no consulta nada.
    usuarioId?: number | null
    mostrarUsuario?: boolean
    // Sin esto no hay acción "Anular", ni modal de anulación, ni avisos de anulación.
    puedeAnular?: boolean
    // Texto cuando no hay pagos y no se filtró nada; con filtros activos siempre es el de "esos filtros".
    vacioSinFiltros?: string
  }>(),
  { usuarioId: undefined, mostrarUsuario: true, puedeAnular: true, vacioSinFiltros: undefined },
)

const TEXTO_VACIO_CON_FILTROS = 'No se encontraron pagos con esos filtros.'

const {
  filtros,
  pagina,
  items,
  total,
  totalPaginas,
  cargando,
  error,
  filtroInvalido,
  hayFiltrosActivos,
  limpiarFiltros,
  recargar,
} = useListaPagos({ usuarioId: props.usuarioId })
const { anulando, error: errorAnulacion, anular, limpiar } = useAnularPago(recargar)
const { descargando, error: errorDescarga, descargar } = useDescargaPdf()
const servicios = useServicios()
const avisos = useAvisosFz()

const aAnular = ref<Pago | null>(null)
const modalAnular = ref(false)

function pedirAnulacion(pago: Pago) {
  limpiar()
  aAnular.value = pago
  modalAnular.value = true
}

async function confirmarAnulacion() {
  const actual = aAnular.value
  if (!actual) return
  const ok = await anular(actual.id)
  if (ok) {
    modalAnular.value = false
    aAnular.value = null
    avisos.exito('Pago anulado', 'Si hace falta volver a cobrar, se hace con una clave nueva.')
    // El pago pasó a ANULADO y su fila ya no tiene acciones: el foco vuelve al primer control que siga en esa fila, o a
    // ninguno si no queda (el modal ya devolvió el foco al botón que ya no existe).
    await nextTick()
    enfocarControlDeFila(`acciones-pago-${actual.id}`, 'anular')
  }
}

function descargarComprobante(pago: Pago) {
  void descargar(`comprobante-${pago.id}.pdf`, () => servicios.pagos.descargarComprobante(pago.id))
}

const hayFilas = computed(() => items.value.length > 0)
const cargandoSinFilas = computed(() => cargando.value && !hayFilas.value)
const vacio = computed(() => !cargando.value && !hayFilas.value && !error.value)
const textoVacio = computed(() => (hayFiltrosActivos.value ? TEXTO_VACIO_CON_FILTROS : (props.vacioSinFiltros ?? TEXTO_VACIO_CON_FILTROS)))

// La región del pie siempre está en el DOM (los lectores de pantalla solo anuncian cambios de una región existente);
// mientras no hay un resultado que informar, queda vacía.
const textoRango = computed(() =>
  cargandoSinFilas.value || error.value ? '' : textoDeRango(total.value, pagina.value, POR_PAGINA_PAGOS, 'pago', 'pagos'),
)
</script>

<template>
  <section class="pagos">
    <EncabezadoPaginaFz :titulo="titulo" :subtitulo="subtitulo">
      <template #insignia>
        <InsigniaFz>{{ total }} {{ total === 1 ? 'pago' : 'pagos' }}</InsigniaFz>
      </template>
    </EncabezadoPaginaFz>

    <FiltrosPagos
      v-model:usuario-id="filtros.usuarioId"
      v-model:estado="filtros.estado"
      v-model:tipo="filtros.tipo"
      v-model:desde="filtros.desde"
      v-model:hasta="filtros.hasta"
      :hay-filtros-activos="hayFiltrosActivos"
      :mostrar-usuario="mostrarUsuario"
      @limpiar="limpiarFiltros"
    />

    <AvisoFz v-if="filtroInvalido" variante="advertencia">La fecha desde no puede ser posterior a la hasta.</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <AvisoFz v-if="puedeAnular && errorAnulacion && !modalAnular" variante="peligro">{{ errorAnulacion }}</AvisoFz>
    <AvisoFz v-if="errorDescarga" variante="peligro">{{ errorDescarga }}</AvisoFz>

    <TablaPagos
      v-if="hayFilas"
      :pagos="items"
      :ocupada="cargando || anulando || descargando"
      :mostrar-usuario="mostrarUsuario"
      :puede-anular="puedeAnular"
      @comprobante="descargarComprobante"
      @anular="pedirAnulacion"
    />
    <p v-else-if="cargandoSinFilas" class="pagos__estado" role="status">Cargando pagos…</p>
    <p v-else-if="vacio" class="pagos__estado pagos__vacio" role="status">{{ textoVacio }}</p>

    <footer class="pagos__pie">
      <p class="pagos__rango" role="status" aria-live="polite" aria-atomic="true">{{ textoRango }}</p>
      <PaginacionFz v-if="totalPaginas > 1" v-model="pagina" :total-paginas="totalPaginas" etiqueta="Paginación de pagos" />
    </footer>

    <ConfirmarAnulacion
      v-if="puedeAnular"
      v-model="modalAnular"
      :pago="aAnular"
      :anulando="anulando"
      :error="errorAnulacion"
      @confirmar="confirmarAnulacion"
    />
  </section>
</template>

<style scoped>
.pagos {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.pagos__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.pagos__vacio {
  padding: var(--fz-espaciado-amplio) 0;
}

.pagos__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.pagos__rango {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
