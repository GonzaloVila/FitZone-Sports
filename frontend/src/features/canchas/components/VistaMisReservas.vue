<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import ModalPagarReserva from '@/features/pagos/components/modales/ModalPagarReserva.vue'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, PaginacionFz, PestanasFz } from '@/ui'
import { useEtiquetasCanchas } from '../composables/useEtiquetasCanchas'
import { POR_PAGINA_RESERVAS, useMisReservas } from '../composables/useMisReservas'
import { useReservaAPagar } from '../composables/useReservaAPagar'
import type { ReservaCancha } from '../services/servicioCanchas'
import type { FilaReserva } from '../tipos'
import ModalCancelarReserva from './ModalCancelarReserva.vue'
import TablaReservas from './TablaReservas.vue'

// Reservas de cancha del usuario (SOCIO o EXTERNO). Se monta solo mientras la vista está activa: la actualización periódica
// de useMisReservas se corta al volver a las canchas.
const {
  pestana,
  pagina,
  total,
  totalPaginas,
  filas,
  cargando,
  error,
  accionando,
  errorAccion,
  exitoAccion,
  ahora,
  sinUsuario,
  cancelar,
  limpiarMensajes,
  recargar,
} = useMisReservas()
// La reserva no trae su cancha: el nombre ("Fútbol 5 #2") y la sede salen de una sola consulta a la lista de canchas.
const { etiquetaDe, sedeIdDe } = useEtiquetasCanchas()
const { nombreDeSede } = useSedes()

const PESTANAS = [
  { id: 'proximas', etiqueta: 'Próximas' },
  { id: 'canceladas', etiqueta: 'Canceladas' },
  { id: 'pasadas', etiqueta: 'Pasadas' },
]

const MENSAJES_VACIO: Record<string, string> = {
  proximas: 'No tenés reservas próximas. Mirá las canchas para reservar un turno.',
  canceladas: 'No tenés reservas canceladas.',
  pasadas: 'Todavía no tenés reservas pasadas.',
}
const mensajeVacio = computed(() => MENSAJES_VACIO[pestana.value] ?? MENSAJES_VACIO.proximas)

// Las filas del panel se muestran aunque se esté actualizando (la tabla queda ocupada); "Cargando" solo mientras no hay nada.
const cargandoSinFilas = computed(() => cargando.value && filas.value.length === 0)

const sedeDeCancha = (canchaId: number) => {
  const id = sedeIdDe(canchaId)
  return id === null ? '—' : nombreDeSede(id)
}

const rangoInicio = computed(() => (total.value === 0 ? 0 : (pagina.value - 1) * POR_PAGINA_RESERVAS + 1))
const rangoFin = computed(() => Math.min(total.value, pagina.value * POR_PAGINA_RESERVAS))
const textoRango = computed(() => {
  if (cargandoSinFilas.value || error.value || total.value === 0) return ''
  return `Mostrando ${rangoInicio.value} a ${rangoFin.value} de ${total.value} ${total.value === 1 ? 'reserva' : 'reservas'}`
})

const modalCancelar = ref(false)
const aCancelar = ref<FilaReserva | null>(null)
const modalPagar = ref(false)
const aPagar = ref<ReservaCancha | null>(null)

function pedirCancelacion(fila: FilaReserva) {
  limpiarMensajes()
  aCancelar.value = fila
  modalCancelar.value = true
}

// Si sale bien el modal se cierra; si falla sigue abierto con el error adentro (un aviso flotante quedaría detrás del
// <dialog>) y la lista ya se volvió a pedir.
async function confirmarCancelacion() {
  if (!aCancelar.value) return
  const ok = await cancelar(aCancelar.value)
  if (ok) modalCancelar.value = false
}

function pedirPago(reserva: ReservaCancha) {
  limpiarMensajes()
  aPagar.value = reserva
  modalPagar.value = true
}

// ?pagar=<id> (la redirección de /pagos/nuevo) abre el mismo modal.
const { error: errorReservaAPagar } = useReservaAPagar(pedirPago)

// Al cerrarse un modal abierto desde el menú de una fila, el foco vuelve al botón "···" de esa fila: el ítem que lo abrió ya
// no existe. Se espera a que el modal termine de cerrarse para que su propia devolución de foco no pise esta.
async function devolverFoco(reservaId: number | undefined) {
  if (reservaId === undefined) return
  await nextTick()
  document.querySelector<HTMLElement>(`[data-identificador="menu-reserva-${reservaId}"]`)?.focus()
}
watch(modalCancelar, (abierto) => {
  if (!abierto) void devolverFoco(aCancelar.value?.reserva.id)
})
watch(modalPagar, (abierto) => {
  if (!abierto) void devolverFoco(aPagar.value?.id)
})
</script>

<template>
  <div class="mis-reservas">
    <AvisoFz v-if="sinUsuario" variante="advertencia">Esta vista necesita un usuario identificado en la sesión.</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <AvisoFz v-if="errorReservaAPagar" variante="peligro">{{ errorReservaAPagar }}</AvisoFz>
    <AvisoFz v-if="errorAccion && !modalCancelar" variante="peligro">{{ errorAccion }}</AvisoFz>
    <AvisoFz v-if="exitoAccion" variante="exito">{{ exitoAccion }}</AvisoFz>

    <PestanasFz v-if="!sinUsuario" v-model="pestana" :pestanas="PESTANAS" etiqueta="Mis reservas de cancha por estado">
      <template v-for="opcion in PESTANAS" :key="opcion.id" #[`panel-${opcion.id}`]>
        <p v-if="cargandoSinFilas" class="mis-reservas__estado" role="status">Cargando tus reservas…</p>
        <div v-else-if="filas.length > 0" class="mis-reservas__panel">
          <TablaReservas
            :filas="filas"
            :ahora="ahora"
            :pestana="pestana"
            :etiqueta-de-cancha="etiquetaDe"
            :nombre-de-sede="sedeDeCancha"
            :ocupada="accionando || cargando"
            @pagar="(fila) => pedirPago(fila.reserva)"
            @cancelar="pedirCancelacion"
          />
          <footer class="mis-reservas__pie">
            <p class="mis-reservas__rango" role="status" aria-live="polite" aria-atomic="true">{{ textoRango }}</p>
            <PaginacionFz v-if="totalPaginas > 1" v-model="pagina" :total-paginas="totalPaginas" etiqueta="Paginación de reservas" />
          </footer>
        </div>
        <p v-else class="mis-reservas__estado" role="status">{{ mensajeVacio }}</p>
      </template>
    </PestanasFz>

    <ModalCancelarReserva
      v-model="modalCancelar"
      :reserva="aCancelar?.reserva ?? null"
      :nombre-cancha="aCancelar ? etiquetaDe(aCancelar.reserva.canchaId) : undefined"
      :cargando="accionando"
      :error="errorAccion"
      @confirmar="confirmarCancelacion"
    />

    <ModalPagarReserva
      v-model:abierto="modalPagar"
      :reserva="aPagar"
      :nombre-cancha="aPagar ? etiquetaDe(aPagar.canchaId) : ''"
      @pagado="recargar"
    />
  </div>
</template>

<style scoped>
.mis-reservas {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.mis-reservas__panel {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.mis-reservas__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.mis-reservas__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.mis-reservas__rango {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
