<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useServicios } from '@/compartido/servicios'
import { AvisoFz } from '@/ui'
import FormularioPago from '../components/FormularioPago.vue'
import ResultadoPago from '../components/ResultadoPago.vue'
import ResumenPago from '../components/ResumenPago.vue'
import { useDescargaPdf } from '../composables/useDescargaPdf'
import { usePagarReserva } from '../composables/usePagarReserva'

const route = useRoute()
const reservaId = Number(route.query.reservaId)
const { reserva, cargando, errorCarga, medio, enviando, error, pago, pagar } = usePagarReserva(reservaId)
const { descargando, error: errorDescarga, descargar } = useDescargaPdf()
const servicios = useServicios()

const reservaValida = computed(() => Number.isInteger(reservaId) && reservaId > 0)

function descargarComprobante() {
  const actual = pago.value
  if (!actual) return
  void descargar(`comprobante-${actual.id}.pdf`, () => servicios.pagos.descargarComprobante(actual.id))
}
</script>

<template>
  <section class="pagar">
    <header class="pagar__encabezado">
      <h1 class="pagar__titulo">Pagar reserva</h1>
      <p class="pagar__subtitulo">Cobro simulado de una reserva de cancha.</p>
    </header>

    <AvisoFz v-if="!reservaValida" variante="peligro">Falta la reserva a pagar.</AvisoFz>
    <AvisoFz v-if="errorCarga" variante="peligro">{{ errorCarga }}</AvisoFz>

    <p v-if="cargando" class="pagar__estado" role="status">Cargando reserva…</p>

    <template v-else-if="reserva">
      <ResumenPago :reserva="reserva" />

      <ResultadoPago v-if="pago" :pago="pago" :descargando="descargando" @comprobante="descargarComprobante" />
      <template v-else>
        <FormularioPago v-model="medio" :enviando="enviando" :error="error" @pagar="pagar" />
        <RouterLink :to="{ name: 'canchas', query: { vista: 'mis-reservas' } }" class="pagar__volver">Volver a mis reservas</RouterLink>
      </template>

      <AvisoFz v-if="errorDescarga" variante="peligro">{{ errorDescarga }}</AvisoFz>
    </template>
  </section>
</template>

<style scoped>
.pagar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 48rem;
  margin: 0 auto;
  width: 100%;
}

.pagar__encabezado {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.pagar__titulo {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fz-color-texto);
}

.pagar__subtitulo {
  margin: 0;
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}

.pagar__estado,
.pagar__volver {
  margin: 0;
  color: var(--fz-color-texto-suave);
}
</style>
