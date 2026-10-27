<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, EncabezadoPaginaFz } from '@/ui'
import CabeceraCancha from '../components/CabeceraCancha.vue'
import ConfirmarReserva from '../components/ConfirmarReserva.vue'
import GrillaTurnos from '../components/GrillaTurnos.vue'
import TiraDeDias from '../components/TiraDeDias.vue'
import { useFechaDeTurnos } from '../composables/useFechaDeTurnos'
import { useGrillaTurnos } from '../composables/useGrillaTurnos'
import { useReservarTurno } from '../composables/useReservarTurno'
import { destinoVolver } from '../direccion'
import { formatearMonto } from '../presentacion'
import { puedeReservar } from '../reglas'
import type { Disponibilidad } from '../services/servicioCanchas'

const route = useRoute()
const { rol } = useUsuarioSesion()
const { nombreDeSede } = useSedes()
const canchaId = Number(route.params.canchaId)

// El día vive en la dirección (?fecha=) y se elige en la tira de los próximos siete días.
const { dias, fecha } = useFechaDeTurnos()

// Quien reserva (SOCIO, EXTERNO) elige un turno libre; RECEPCION y GERENTE consultan la disponibilidad.
const reservaPermitida = computed(() => puedeReservar(rol.value))

// "Volver" se arma con la dirección (de dónde se vino y con qué filtros), no con el historial: sirve igual al recargar.
// "Mis reservas" existe para quien reserva.
const volver = computed(() => destinoVolver(route.query, reservaPermitida.value))

const { cancha, cargandoCancha, errorCancha, mantenimiento, turnos, cargando, error, ahora, reservasDelDia, recargar } =
  useGrillaTurnos(canchaId, fecha)
const { enviando, error: errorReserva, reserva: reservaHecha, reservar, limpiar } = useReservarTurno(recargar)

const seleccionado = ref<Disponibilidad | null>(null)
const abierto = ref(false)

function elegir(turno: Disponibilidad) {
  limpiar()
  seleccionado.value = turno
  abierto.value = true
}

// Si sale bien el modal se cierra; si falla sigue abierto con el error adentro (un aviso flotante quedaría detrás del
// <dialog>) y, si el turno ya estaba tomado, la grilla ya se volvió a pedir.
async function confirmar() {
  const turno = seleccionado.value
  if (!turno) return
  const ok = await reservar(canchaId, { inicio: turno.fechaHoraInicio, fin: turno.fechaHoraFin })
  if (!ok) return
  abierto.value = false
  seleccionado.value = null
}

const cargandoTurnos = computed(() => cargandoCancha.value || cargando.value)
const sinTurnos = computed(() => !cargandoTurnos.value && turnos.value.length === 0 && !error.value)

const subtitulo = computed(() =>
  reservaPermitida.value
    ? 'Elegí un día y un turno libre para reservar.'
    : 'Elegí un día para ver qué turnos están libres y cuáles ocupados.',
)
</script>

<template>
  <section class="turnos-pagina">
    <EncabezadoPaginaFz titulo="Turnos" :subtitulo="subtitulo" :volver="volver" />

    <CabeceraCancha v-if="cancha" :cancha="cancha" :nombre-sede="nombreDeSede(cancha.sedeId)" />

    <TiraDeDias v-model="fecha" :dias="dias" />

    <AvisoFz v-if="errorCancha" variante="peligro">{{ errorCancha }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <AvisoFz v-if="errorReserva && !abierto" variante="peligro">{{ errorReserva }}</AvisoFz>
    <AvisoFz v-if="reservaPermitida && reservaHecha" variante="exito">
      Reserva confirmada por {{ formatearMonto(reservaHecha.precioAplicado) }}.
      <RouterLink :to="{ name: 'pagar-reserva', query: { reservaId: reservaHecha.id } }">Pagar ahora</RouterLink>
    </AvisoFz>

    <AvisoFz v-if="mantenimiento" variante="advertencia">
      La cancha está en mantenimiento: no se reservan turnos nuevos. Las reservas ya tomadas se mantienen.
    </AvisoFz>
    <p v-if="!reservaPermitida" class="turnos-pagina__estado">
      Estás consultando la disponibilidad: los turnos los reserva cada socio o cliente desde su cuenta.
    </p>

    <p v-if="cargandoTurnos" class="turnos-pagina__estado" role="status">Cargando turnos…</p>
    <GrillaTurnos
      v-else-if="turnos.length > 0"
      :turnos="turnos"
      :mantenimiento="mantenimiento"
      :reservas="reservasDelDia"
      :ahora="ahora"
      :puede-reservar="reservaPermitida"
      @elegir="elegir"
    />
    <p v-else-if="sinTurnos" class="turnos-pagina__estado" role="status">No hay turnos para ese día.</p>

    <ConfirmarReserva
      v-if="reservaPermitida"
      v-model="abierto"
      :cancha="cancha"
      :turno="seleccionado"
      :enviando="enviando"
      :error="errorReserva"
      @confirmar="confirmar"
    />
  </section>
</template>

<style scoped>
.turnos-pagina {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.turnos-pagina__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
