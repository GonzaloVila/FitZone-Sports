<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import ModalPagarReserva from '@/features/pagos/components/modales/ModalPagarReserva.vue'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, BotonFz, CampoFormularioFz, EncabezadoPaginaFz } from '@/ui'
import ConfirmarReserva from '../components/ConfirmarReserva.vue'
import GrillaTurnos from '../components/GrillaTurnos.vue'
import { useFechaDeTurnos } from '../composables/useFechaDeTurnos'
import { useGrillaTurnos } from '../composables/useGrillaTurnos'
import { useReservarTurno } from '../composables/useReservarTurno'
import { destinoVolver } from '../direccion'
import { nombreDeCancha } from '../edicion'
import { formatearMonto } from '../presentacion'
import { puedeReservar } from '../reglas'
import type { Disponibilidad } from '../services/servicioCanchas'
import { clasificarTurnos } from '../turnos'

const route = useRoute()
const { rol } = useUsuarioSesion()
const { nombreDeSede } = useSedes()
const canchaId = Number(route.params.canchaId)

// El día vive en la dirección (?fecha=) y se elige en un campo de fecha: de hoy a hoy + 6.
const { hoy, ultimo, fecha, campo } = useFechaDeTurnos()

// Quien reserva (SOCIO, EXTERNO) tiene el botón "Reservar" en los turnos libres; RECEPCION y GERENTE ven la tabla sin acciones.
const reservaPermitida = computed(() => puedeReservar(rol.value))

// "Volver" se arma con la dirección (de dónde se vino y con qué filtros), no con el historial: sirve igual al recargar.
// "Mis reservas" existe para quien reserva.
const volver = computed(() => destinoVolver(route.query, reservaPermitida.value))

const { cancha, cargandoCancha, errorCancha, mantenimiento, turnos, cargando, error, ahora, recargar } = useGrillaTurnos(
  canchaId,
  fecha,
)
const { enviando, error: errorReserva, reserva: reservaHecha, reservar, limpiar } = useReservarTurno(recargar)

// Un solo título (la cancha) y una línea suave debajo: "Sede · precio base por hora".
const titulo = computed(() => (cancha.value ? nombreDeCancha(cancha.value) : 'Turnos'))
const detalle = computed(() =>
  cancha.value ? `${nombreDeSede(cancha.value.sedeId)} · ${formatearMonto(cancha.value.costoPorHora)} por hora` : undefined,
)

// Todos los turnos del día, también los que ya pasaron, cada uno pasado, libre u ocupado.
const clasificados = computed(() => clasificarTurnos(turnos.value, ahora.value))

const seleccionado = ref<Disponibilidad | null>(null)
const abierto = ref(false)

// El pago de la reserva que se acaba de hacer: se abre desde el aviso "Pagar ahora" y, al cerrarlo después de un pago aprobado,
// el aviso pasa a decir que la reserva está pagada.
const pagoAbierto = ref(false)
const reservaPagada = ref<number | null>(null)
const yaPagada = computed(() => reservaHecha.value !== null && reservaHecha.value.id === reservaPagada.value)

function elegir(turno: Disponibilidad) {
  limpiar()
  seleccionado.value = turno
  abierto.value = true
}

// Si sale bien el modal se cierra; si falla sigue abierto con el error adentro (un aviso flotante quedaría detrás del
// <dialog>) y, si el turno ya estaba tomado, los turnos ya se volvieron a pedir.
async function confirmar() {
  const turno = seleccionado.value
  if (!turno) return
  const ok = await reservar(canchaId, { inicio: turno.fechaHoraInicio, fin: turno.fechaHoraFin })
  if (!ok) return
  abierto.value = false
  seleccionado.value = null
}
</script>

<template>
  <section class="turnos-pagina">
    <EncabezadoPaginaFz :titulo="titulo" :subtitulo="detalle" :volver="volver" />

    <AvisoFz v-if="errorCancha" variante="peligro">{{ errorCancha }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <AvisoFz v-if="errorReserva && !abierto" variante="peligro">{{ errorReserva }}</AvisoFz>
    <AvisoFz v-if="reservaPermitida && reservaHecha" variante="exito">
      <div class="turnos-pagina__reserva">
        <span v-if="yaPagada">Reserva confirmada y pagada por {{ formatearMonto(reservaHecha.precioAplicado) }}.</span>
        <template v-else>
          <span>Reserva confirmada por {{ formatearMonto(reservaHecha.precioAplicado) }}.</span>
          <!-- Abre el modal de pago en esta misma pantalla (no navega): por eso es un botón y no un enlace. -->
          <BotonFz variante="secundario" tamano="sm" @click="pagoAbierto = true">Pagar ahora</BotonFz>
        </template>
      </div>
    </AvisoFz>

    <p v-if="cargandoCancha" class="turnos-pagina__estado" role="status">Cargando turnos…</p>

    <!-- En mantenimiento no se muestra nada más que esta línea: ni la fecha ni la tabla. -->
    <AvisoFz v-else-if="mantenimiento" variante="advertencia">Esta cancha está en mantenimiento: no se reservan turnos nuevos.</AvisoFz>

    <template v-else-if="cancha">
      <div class="turnos-pagina__fecha">
        <CampoFormularioFz v-model="campo" etiqueta="Fecha" tipo="date" name="fecha" :min="hoy" :max="ultimo" />
      </div>

      <p v-if="cargando" class="turnos-pagina__estado" role="status">Cargando turnos…</p>
      <GrillaTurnos v-else-if="clasificados.length > 0" :turnos="clasificados" :puede-reservar="reservaPermitida" @elegir="elegir" />
      <p v-else-if="!error" class="turnos-pagina__estado" role="status">No hay turnos para este día.</p>
    </template>

    <ConfirmarReserva
      v-if="reservaPermitida"
      v-model="abierto"
      :cancha="cancha"
      :turno="seleccionado"
      :enviando="enviando"
      :error="errorReserva"
      @confirmar="confirmar"
    />

    <ModalPagarReserva
      v-if="reservaPermitida"
      v-model:abierto="pagoAbierto"
      :reserva="reservaHecha"
      :nombre-cancha="cancha ? nombreDeCancha(cancha) : `Cancha #${canchaId}`"
      @pagado="reservaPagada = reservaHecha?.id ?? null"
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

/* El campo de fecha mide lo que su contenido; en ancho chico ocupa todo el ancho disponible. */
.turnos-pagina__fecha {
  width: max-content;
  max-width: 100%;
}

.turnos-pagina__reserva {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-base);
}

.turnos-pagina__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
