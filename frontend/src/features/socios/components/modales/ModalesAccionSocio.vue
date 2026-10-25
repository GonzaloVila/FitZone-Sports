<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Membresia, Plan } from '../../services/servicioSocios'
import type { AccionConModal, SocioResumen } from '../../tipos'
import ModalCambiarPlan from './ModalCambiarPlan.vue'
import ModalDejarDeSerSocio from './ModalDejarDeSerSocio.vue'
import ModalSuspender from './ModalSuspender.vue'

const props = defineProps<{
  // Qué modal está abierto (null = ninguno). Quien lo usa maneja el estado y la ejecución.
  accion: AccionConModal | null
  socio: SocioResumen | null
  membresia: Membresia | null
  ejecutando: boolean
  error: string | null
}>()

const emit = defineEmits<{
  cerrar: []
  'confirmar-plan': [plan: Plan]
  suspender: []
  reactivar: []
  'dejar-de-ser-socio': []
}>()

// Al cerrarse, `socio` vuelve a null pero el modal tiene que seguir montado hasta terminar de cerrarse (así
// devuelve el foco): se conserva el último socio y membresía que se mostraron.
const ultimoSocio = ref<SocioResumen | null>(props.socio)
const ultimaMembresia = ref<Membresia | null>(props.membresia)
watch(
  () => [props.socio, props.membresia] as const,
  ([socio, membresia]) => {
    if (!socio) return
    ultimoSocio.value = socio
    ultimaMembresia.value = membresia
  },
)

function alCambiarApertura(abierto: boolean) {
  if (!abierto) emit('cerrar')
}

// Suspender y reactivar comparten modal: el botón confirma la que esté abierta.
function alConfirmarSuspension() {
  if (props.accion === 'reactivar') emit('reactivar')
  else emit('suspender')
}
</script>

<template>
  <template v-if="ultimoSocio">
    <ModalCambiarPlan
      :abierto="accion === 'cambiar-plan'"
      :socio="ultimoSocio"
      :membresia="ultimaMembresia"
      :ejecutando="ejecutando"
      :error="error"
      @update:abierto="alCambiarApertura"
      @confirmar="emit('confirmar-plan', $event)"
    />
    <ModalSuspender
      :abierto="accion === 'suspender' || accion === 'reactivar'"
      :modo="accion === 'reactivar' ? 'reactivar' : 'suspender'"
      :socio="ultimoSocio"
      :membresia="ultimaMembresia"
      :ejecutando="ejecutando"
      :error="error"
      @update:abierto="alCambiarApertura"
      @confirmar="alConfirmarSuspension"
    />
    <ModalDejarDeSerSocio
      :abierto="accion === 'dejar-de-ser-socio'"
      :socio="ultimoSocio"
      :ejecutando="ejecutando"
      :error="error"
      @update:abierto="alCambiarApertura"
      @confirmar="emit('dejar-de-ser-socio')"
    />
  </template>
</template>
