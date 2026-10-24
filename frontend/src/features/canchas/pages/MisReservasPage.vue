<script setup lang="ts">
import { computed, ref } from 'vue'
import { AvisoFz, BotonFz, ModalFz, PestanasFz } from '@/ui'
import TablaReservas from '../components/TablaReservas.vue'
import { useMisReservas } from '../composables/useMisReservas'
import { rangoDeTurno } from '../presentacion'
import type { FilaReserva } from '../tipos'

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
} = useMisReservas()

const PESTANAS = [
  { id: 'proximas', etiqueta: 'Próximas' },
  { id: 'canceladas', etiqueta: 'Canceladas' },
  { id: 'pasadas', etiqueta: 'Pasadas' },
]

const aCancelar = ref<FilaReserva | null>(null)
const modalCancelar = ref(false)

const mensajeVacio = computed(() => {
  if (pestana.value === 'canceladas') return 'No tenés reservas canceladas.'
  if (pestana.value === 'pasadas') return 'No tenés reservas pasadas.'
  return 'No tenés reservas próximas.'
})

function pedirCancelacion(fila: FilaReserva) {
  aCancelar.value = fila
  modalCancelar.value = true
}

async function confirmarCancelacion() {
  const fila = aCancelar.value
  if (!fila) return
  await cancelar(fila)
  modalCancelar.value = false
  aCancelar.value = null
}
</script>

<template>
  <section class="mis-reservas">
    <header class="mis-reservas__encabezado">
      <h1 class="mis-reservas__titulo">Mis reservas</h1>
      <p class="mis-reservas__subtitulo">Tus reservas de cancha, con la opción de pagar o cancelar.</p>
    </header>

    <AvisoFz v-if="sinUsuario" variante="advertencia">
      Esta vista necesita un usuario identificado en la sesión.
    </AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <AvisoFz v-if="exitoAccion" variante="exito">{{ exitoAccion }}</AvisoFz>
    <AvisoFz v-if="errorAccion" variante="peligro">{{ errorAccion }}</AvisoFz>

    <p v-if="cargando" class="mis-reservas__estado" role="status">Cargando reservas…</p>

    <PestanasFz v-else-if="!sinUsuario" v-model="pestana" :pestanas="PESTANAS" etiqueta="Reservas por estado">
      <template #panel-proximas>
        <TablaReservas
          v-if="filas.length > 0"
          :filas="filas"
          :cancelando="accionando"
          :ahora="ahora"
          @cancelar="pedirCancelacion"
        />
        <p v-else class="mis-reservas__vacio">{{ mensajeVacio }}</p>
      </template>
      <template #panel-canceladas>
        <TablaReservas
          v-if="filas.length > 0"
          :filas="filas"
          :cancelando="accionando"
          :ahora="ahora"
          @cancelar="pedirCancelacion"
        />
        <p v-else class="mis-reservas__vacio">{{ mensajeVacio }}</p>
      </template>
      <template #panel-pasadas>
        <TablaReservas
          v-if="filas.length > 0"
          :filas="filas"
          :cancelando="accionando"
          :ahora="ahora"
          @cancelar="pedirCancelacion"
        />
        <p v-else class="mis-reservas__vacio">{{ mensajeVacio }}</p>
      </template>
    </PestanasFz>

    <ModalFz v-model="modalCancelar" titulo="Cancelar reserva" :ocupado="accionando">
      <div v-if="aCancelar" class="mis-reservas__confirmar">
        <p class="mis-reservas__dato">
          Cancha #{{ aCancelar.reserva.canchaId }} ·
          {{ rangoDeTurno(aCancelar.reserva.fechaHoraInicio, aCancelar.reserva.fechaHoraFin) }}
        </p>
        <p class="mis-reservas__nota">La cancelación no se puede deshacer.</p>
      </div>
      <template #acciones="{ cerrar }">
        <BotonFz variante="secundario" :disabled="accionando" @click="cerrar">Volver</BotonFz>
        <BotonFz variante="peligro" :cargando="accionando" :disabled="accionando" @click="confirmarCancelacion">
          Cancelar reserva
        </BotonFz>
      </template>
    </ModalFz>
  </section>
</template>

<style scoped>
.mis-reservas {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 64rem;
  margin: 0 auto;
  width: 100%;
}

.mis-reservas__encabezado {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.mis-reservas__titulo {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fz-color-texto);
}

.mis-reservas__subtitulo {
  margin: 0;
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}

.mis-reservas__estado,
.mis-reservas__vacio {
  margin: 0;
  color: var(--fz-color-texto-suave);
}

.mis-reservas__confirmar {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.mis-reservas__dato {
  margin: 0;
}

.mis-reservas__nota {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}
</style>
