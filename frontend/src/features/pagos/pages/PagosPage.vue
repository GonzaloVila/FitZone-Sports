<script setup lang="ts">
import { computed, ref } from 'vue'
import { useServicios } from '@/compartido/servicios'
import { AvisoFz, PaginacionFz } from '@/ui'
import ConfirmarAnulacion from '../components/ConfirmarAnulacion.vue'
import FiltrosPagos from '../components/FiltrosPagos.vue'
import TablaPagos from '../components/TablaPagos.vue'
import { useAnularPago } from '../composables/useAnularPago'
import { useDescargaPdf } from '../composables/useDescargaPdf'
import { useListaPagos } from '../composables/useListaPagos'
import type { Pago } from '../services/servicioPagos'

const { filtros, pagina, items, total, totalPaginas, cargando, error, filtroInvalido, recargar } = useListaPagos()
const { anulando, error: errorAnulacion, exito, anular, limpiar } = useAnularPago(recargar)
const { descargando, error: errorDescarga, descargar } = useDescargaPdf()
const servicios = useServicios()

const aAnular = ref<Pago | null>(null)
const modalAnular = ref(false)
const hayFilas = computed(() => items.value.length > 0)

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
  }
}

function descargarComprobante(pago: Pago) {
  void descargar(`comprobante-${pago.id}.pdf`, () => servicios.pagos.descargarComprobante(pago.id))
}
</script>

<template>
  <section class="pagos">
    <header class="pagos__encabezado">
      <div>
        <h1 class="pagos__titulo">Pagos</h1>
        <p class="pagos__subtitulo">Por defecto se ven los aprobados; elegí un estado para ver otros.</p>
      </div>
      <span class="pagos__total">{{ total }} {{ total === 1 ? 'pago' : 'pagos' }}</span>
    </header>

    <FiltrosPagos
      v-model:estado="filtros.estado"
      v-model:tipo="filtros.tipo"
      v-model:desde="filtros.desde"
      v-model:hasta="filtros.hasta"
    />

    <AvisoFz v-if="filtroInvalido" variante="advertencia">
      La fecha desde no puede ser posterior a la hasta.
    </AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <AvisoFz v-if="exito" variante="exito">{{ exito }}</AvisoFz>
    <AvisoFz v-if="errorAnulacion && !modalAnular" variante="peligro">{{ errorAnulacion }}</AvisoFz>
    <AvisoFz v-if="errorDescarga" variante="peligro">{{ errorDescarga }}</AvisoFz>

    <p v-if="cargando" class="pagos__estado" role="status">Cargando pagos…</p>
    <TablaPagos
      v-else-if="hayFilas"
      :pagos="items"
      :ocupada="anulando || descargando"
      @comprobante="descargarComprobante"
      @anular="pedirAnulacion"
    />
    <p v-else class="pagos__vacio">No hay pagos con esos filtros.</p>

    <footer v-if="hayFilas" class="pagos__pie">
      <PaginacionFz
        v-if="totalPaginas > 1"
        v-model="pagina"
        :total-paginas="totalPaginas"
        etiqueta="Paginación de pagos"
      />
    </footer>

    <ConfirmarAnulacion
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
  gap: 1.5rem;
  max-width: 64rem;
  margin: 0 auto;
  width: 100%;
}

.pagos__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.pagos__titulo {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fz-color-texto);
}

.pagos__subtitulo {
  margin: 0;
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}

.pagos__total {
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}

.pagos__estado,
.pagos__vacio {
  margin: 0;
  color: var(--fz-color-texto-suave);
}

.pagos__pie {
  display: flex;
  justify-content: center;
}
</style>
