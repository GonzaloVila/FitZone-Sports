<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, CampoFormularioFz, EncabezadoPaginaFz, InsigniaFz } from '@/ui'
import ConfirmarReserva from '../components/ConfirmarReserva.vue'
import GrillaTurnos from '../components/GrillaTurnos.vue'
import { useGrillaTurnos } from '../composables/useGrillaTurnos'
import { useReservarTurno } from '../composables/useReservarTurno'
import { destinoVolver } from '../direccion'
import { ETIQUETA_ESTADO_CANCHA, ETIQUETA_TIPO_CANCHA, fechaDeHoy, formatearMonto } from '../presentacion'
import { puedeReservar } from '../reglas'
import type { Disponibilidad } from '../services/servicioCanchas'

const route = useRoute()
const { rol } = useUsuarioSesion()
const canchaId = Number(route.params.canchaId)
const fecha = ref(fechaDeHoy())
const hoy = fechaDeHoy()

// Quien reserva (SOCIO, EXTERNO) ve "Reservar" en los turnos libres; RECEPCION y GERENTE consultan la disponibilidad.
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

const subtitulo = computed(() => {
  const c = cancha.value
  return c ? `${ETIQUETA_TIPO_CANCHA[c.tipo]} #${c.id} · ${formatearMonto(c.costoPorHora)} por hora` : undefined
})
</script>

<template>
  <section class="grilla-pagina">
    <EncabezadoPaginaFz titulo="Turnos" :subtitulo="subtitulo" :volver="volver">
      <template v-if="cancha" #insignia>
        <InsigniaFz :variante="mantenimiento ? 'advertencia' : 'exito'">{{ ETIQUETA_ESTADO_CANCHA[cancha.estado] }}</InsigniaFz>
      </template>
    </EncabezadoPaginaFz>

    <div class="grilla-pagina__fecha">
      <CampoFormularioFz v-model="fecha" etiqueta="Día" etiqueta-chica tipo="date" name="fecha" :min="hoy" />
    </div>

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
    <p v-if="!reservaPermitida" class="grilla-pagina__estado">
      Estás consultando la disponibilidad: los turnos los reserva cada socio o cliente desde su cuenta.
    </p>

    <p v-if="cargandoTurnos" class="grilla-pagina__estado" role="status">Cargando turnos…</p>
    <GrillaTurnos
      v-else-if="turnos.length > 0"
      :turnos="turnos"
      :mantenimiento="mantenimiento"
      :reservas="reservasDelDia"
      :ahora="ahora"
      :puede-reservar="reservaPermitida"
      @elegir="elegir"
    />
    <p v-else-if="sinTurnos" class="grilla-pagina__estado" role="status">No hay turnos para ese día.</p>

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
.grilla-pagina {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

/* El campo de día mide lo que su contenido; en ancho chico ocupa todo el ancho disponible. */
.grilla-pagina__fecha {
  width: max-content;
  max-width: 100%;
}

.grilla-pagina__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
