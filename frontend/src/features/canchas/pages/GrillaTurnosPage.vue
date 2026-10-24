<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { AvisoFz, BotonFz, CampoTextoFz } from '@/ui'
import ConfirmarReserva from '../components/ConfirmarReserva.vue'
import GrillaTurnos from '../components/GrillaTurnos.vue'
import { useGrillaTurnos } from '../composables/useGrillaTurnos'
import { useReservarTurno } from '../composables/useReservarTurno'
import {
  ETIQUETA_ESTADO_CANCHA,
  ETIQUETA_TIPO_CANCHA,
  fechaDeHoy,
  formatearMonto,
} from '../presentacion'
import type { Disponibilidad } from '../services/servicioCanchas'

const route = useRoute()
const canchaId = Number(route.params.canchaId)
const fecha = ref(fechaDeHoy())

const {
  cancha,
  cargandoCancha,
  errorCancha,
  mantenimiento,
  turnos,
  cargando,
  error,
  ahora,
  reservasDelDia,
  recargar,
} = useGrillaTurnos(canchaId, fecha)
const { enviando, error: errorReserva, reserva, reservar, limpiar } = useReservarTurno(recargar)

const seleccionado = ref<Disponibilidad | null>(null)
const abierto = ref(false)

function elegir(turno: Disponibilidad) {
  limpiar()
  seleccionado.value = turno
  abierto.value = true
}

async function confirmar() {
  const turno = seleccionado.value
  if (!turno) return
  const ok = await reservar(canchaId, { inicio: turno.fechaHoraInicio, fin: turno.fechaHoraFin })
  abierto.value = false
  if (ok) seleccionado.value = null
}

const sinTurnos = computed(() => !cargando.value && turnos.value.length === 0)
</script>

<template>
  <section class="grilla-pagina">
    <header class="grilla-pagina__encabezado">
      <div>
        <h1 class="grilla-pagina__titulo">Turnos</h1>
        <p v-if="cancha" class="grilla-pagina__subtitulo">
          {{ ETIQUETA_TIPO_CANCHA[cancha.tipo] }} #{{ cancha.id }} · {{ ETIQUETA_ESTADO_CANCHA[cancha.estado] }} ·
          {{ formatearMonto(cancha.costoPorHora) }} por hora
        </p>
      </div>
      <RouterLink :to="{ name: 'canchas' }">
        <BotonFz variante="secundario">Volver a canchas</BotonFz>
      </RouterLink>
    </header>

    <label class="grilla-pagina__fecha">
      <span class="grilla-pagina__etiqueta">Día</span>
      <CampoTextoFz v-model="fecha" tipo="date" :min="fechaDeHoy()" />
    </label>

    <AvisoFz v-if="errorCancha" variante="peligro">{{ errorCancha }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <AvisoFz v-if="errorReserva" variante="peligro">{{ errorReserva }}</AvisoFz>
    <AvisoFz v-if="reserva" variante="exito">
      Reserva confirmada por {{ formatearMonto(reserva.precioAplicado) }}.
      <RouterLink :to="{ name: 'pagar-reserva', query: { reservaId: reserva.id } }">Pagar ahora</RouterLink>
    </AvisoFz>

    <p v-if="mantenimiento" class="grilla-pagina__mantenimiento">
      La cancha está en mantenimiento: no se reservan turnos nuevos. Las reservas ya tomadas se mantienen.
    </p>

    <p v-if="cargandoCancha || cargando" class="grilla-pagina__estado" role="status">Cargando turnos…</p>
    <GrillaTurnos
      v-else-if="turnos.length > 0"
      :turnos="turnos"
      :mantenimiento="mantenimiento"
      :reservas="reservasDelDia"
      :ahora="ahora"
      @elegir="elegir"
    />
    <p v-else-if="sinTurnos" class="grilla-pagina__estado">No hay turnos para ese día.</p>

    <ConfirmarReserva
      v-model="abierto"
      :cancha="cancha"
      :turno="seleccionado"
      :enviando="enviando"
      :error="null"
      @confirmar="confirmar"
    />
  </section>
</template>

<style scoped>
.grilla-pagina {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 64rem;
  margin: 0 auto;
  width: 100%;
}

.grilla-pagina__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.grilla-pagina__titulo {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fz-color-texto);
}

.grilla-pagina__subtitulo {
  margin: 0;
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}

.grilla-pagina__fecha {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-width: 14rem;
}

.grilla-pagina__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: 600;
  color: var(--fz-color-texto);
}

.grilla-pagina__estado,
.grilla-pagina__mantenimiento {
  margin: 0;
  color: var(--fz-color-texto-suave);
}
</style>
