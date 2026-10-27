<script setup lang="ts">
import { computed, ref } from 'vue'
import { AvisoFz, PestanasFz } from '@/ui'
import { useMisReservas } from '../composables/useMisReservas'
import type { FilaReserva } from '../tipos'
import ModalCancelarReserva from './ModalCancelarReserva.vue'
import TablaReservas from './TablaReservas.vue'

// Reservas de cancha del usuario (SOCIO o EXTERNO). Se monta solo mientras la vista está activa: la actualización periódica
// de useMisReservas se corta al volver a las canchas.
const {
  pestana,
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
} = useMisReservas()

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

const modalCancelar = ref(false)
const aCancelar = ref<FilaReserva | null>(null)

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
</script>

<template>
  <div class="mis-reservas">
    <AvisoFz v-if="sinUsuario" variante="advertencia">Esta vista necesita un usuario identificado en la sesión.</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <AvisoFz v-if="errorAccion && !modalCancelar" variante="peligro">{{ errorAccion }}</AvisoFz>
    <AvisoFz v-if="exitoAccion" variante="exito">{{ exitoAccion }}</AvisoFz>

    <PestanasFz v-if="!sinUsuario" v-model="pestana" :pestanas="PESTANAS" etiqueta="Mis reservas de cancha por estado">
      <template v-for="opcion in PESTANAS" :key="opcion.id" #[`panel-${opcion.id}`]>
        <p v-if="cargando" class="mis-reservas__estado" role="status">Cargando tus reservas…</p>
        <TablaReservas v-else-if="filas.length > 0" :filas="filas" :ahora="ahora" :ocupada="accionando" @cancelar="pedirCancelacion" />
        <p v-else class="mis-reservas__estado" role="status">{{ mensajeVacio }}</p>
      </template>
    </PestanasFz>

    <ModalCancelarReserva
      v-model="modalCancelar"
      :reserva="aCancelar?.reserva ?? null"
      :cargando="accionando"
      :error="errorAccion"
      @confirmar="confirmarCancelacion"
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

.mis-reservas__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
