<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { AvisoFz, BotonFz, ModalFz, SelectFz } from '@/ui'
import { ETIQUETAS_PLAN, PLANES } from '../presentacion'
import type { Plan } from '../services/servicioSocios'
import type { AccionSocio } from '../tipos'

const props = defineProps<{
  puedeSuspender: boolean
  puedeReactivar: boolean
  hayMembresia: boolean
  renuevaAutomatica: boolean | null
  planActual: Plan | null
  sedeActualId: number
  sedes: Sede[]
  // Acción en curso (null si no hay) y error de la última acción.
  ejecutando: AccionSocio | null
  error: string | null
}>()

const emit = defineEmits<{
  abrir: []
  suspender: []
  reactivar: []
  cambiarPlan: [plan: Plan]
  alternarRenovacion: []
  cambiarSede: [sedeId: number]
  dejarDeSerSocio: []
}>()

const accion = ref<AccionSocio | null>(null)
const planElegido = ref<string>('')
const sedeElegida = ref<string>('')
const idPlan = useId()
const idSede = useId()

const abierto = computed({
  get: () => accion.value !== null,
  set: (valor) => {
    if (!valor) accion.value = null
  },
})
const ocupado = computed(() => props.ejecutando !== null)

function abrir(nueva: AccionSocio) {
  planElegido.value = props.planActual ?? PLANES[0] ?? ''
  sedeElegida.value = String(props.sedeActualId)
  emit('abrir')
  accion.value = nueva
}

// Si la acción terminó bien (dejó de estar en curso y no hay error), el modal se cierra solo.
watch(
  () => props.ejecutando,
  (nueva, anterior) => {
    if (anterior !== null && nueva === null && !props.error) accion.value = null
  },
)

const planValido = computed(() => PLANES.find((plan) => plan === planElegido.value))
const sedeNueva = computed(() => Number(sedeElegida.value))
const sedeCambio = computed(() => Number.isInteger(sedeNueva.value) && sedeNueva.value !== props.sedeActualId)

const TITULOS: Record<AccionSocio, string> = {
  suspender: 'Suspender la membresía',
  reactivar: 'Reactivar la membresía',
  'cambiar-plan': 'Cambiar el plan',
  'renovacion-automatica': 'Renovación automática',
  'cambiar-sede': 'Cambiar la sede de origen',
  'dejar-de-ser-socio': 'Dejar de ser socio',
}

const titulo = computed(() => (accion.value ? TITULOS[accion.value] : ''))

const textoConfirmar = computed(() => {
  switch (accion.value) {
    case 'suspender':
      return 'Suspender'
    case 'reactivar':
      return 'Reactivar'
    case 'cambiar-plan':
      return 'Cambiar plan'
    case 'cambiar-sede':
      return 'Cambiar sede'
    case 'dejar-de-ser-socio':
      return 'Dejar de ser socio'
    default:
      return props.renuevaAutomatica ? 'Desactivar' : 'Activar'
  }
})

const confirmarDeshabilitado = computed(() => {
  if (accion.value === 'cambiar-plan') return !planValido.value
  if (accion.value === 'cambiar-sede') return !sedeCambio.value
  return false
})

function confirmar() {
  switch (accion.value) {
    case 'suspender':
      return emit('suspender')
    case 'reactivar':
      return emit('reactivar')
    case 'cambiar-plan':
      if (planValido.value) emit('cambiarPlan', planValido.value)
      return
    case 'renovacion-automatica':
      return emit('alternarRenovacion')
    case 'cambiar-sede':
      if (sedeCambio.value) emit('cambiarSede', sedeNueva.value)
      return
    case 'dejar-de-ser-socio':
      return emit('dejarDeSerSocio')
  }
}
</script>

<template>
  <div class="acciones">
    <BotonFz v-if="puedeSuspender" variante="secundario" @click="abrir('suspender')">Suspender</BotonFz>
    <BotonFz v-if="puedeReactivar" variante="secundario" @click="abrir('reactivar')">Reactivar</BotonFz>
    <BotonFz v-if="hayMembresia" variante="secundario" @click="abrir('cambiar-plan')">Cambiar plan</BotonFz>
    <BotonFz v-if="hayMembresia" variante="secundario" @click="abrir('renovacion-automatica')">
      {{ renuevaAutomatica ? 'Desactivar renovación automática' : 'Activar renovación automática' }}
    </BotonFz>
    <BotonFz variante="secundario" @click="abrir('cambiar-sede')">Cambiar sede de origen</BotonFz>
    <BotonFz variante="peligro" @click="abrir('dejar-de-ser-socio')">Dejar de ser socio</BotonFz>

    <ModalFz v-model="abierto" :titulo="titulo" :ocupado="ocupado">
      <template v-if="accion === 'suspender'">
        <p class="acciones__texto">La membresía quedará suspendida hasta que se reactive.</p>
      </template>

      <template v-else-if="accion === 'reactivar'">
        <p class="acciones__texto">La membresía volverá a estar activa.</p>
      </template>

      <template v-else-if="accion === 'cambiar-plan'">
        <div class="acciones__campo">
          <label :for="idPlan" class="acciones__etiqueta">Plan nuevo</label>
          <SelectFz :id="idPlan" v-model="planElegido" :disabled="ocupado">
            <option v-for="plan in PLANES" :key="plan" :value="plan">{{ ETIQUETAS_PLAN[plan] }}</option>
          </SelectFz>
        </div>
        <p class="acciones__texto">
          Abre un período nuevo desde hoy; los días que quedaban del anterior no se trasladan.
        </p>
      </template>

      <template v-else-if="accion === 'renovacion-automatica'">
        <p class="acciones__texto">
          {{
            renuevaAutomatica
              ? 'La membresía dejará de renovarse sola al vencer.'
              : 'La membresía se renovará sola al vencer.'
          }}
        </p>
      </template>

      <template v-else-if="accion === 'cambiar-sede'">
        <div class="acciones__campo">
          <label :for="idSede" class="acciones__etiqueta">Sede de origen</label>
          <SelectFz :id="idSede" v-model="sedeElegida" :disabled="ocupado">
            <option v-for="sede in sedes" :key="sede.id" :value="String(sede.id)">{{ sede.nombre }}</option>
          </SelectFz>
        </div>
      </template>

      <template v-else-if="accion === 'dejar-de-ser-socio'">
        <p class="acciones__texto">
          Se elimina la membresía del socio y el usuario vuelve a ser EXTERNO. El historial de reservas y pagos se
          conserva.
        </p>
      </template>

      <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

      <template #acciones="{ cerrar }">
        <BotonFz variante="secundario" :disabled="ocupado" @click="cerrar">Cancelar</BotonFz>
        <BotonFz
          :variante="accion === 'dejar-de-ser-socio' ? 'peligro' : 'primario'"
          :cargando="ocupado"
          :disabled="confirmarDeshabilitado"
          @click="confirmar"
        >
          {{ textoConfirmar }}
        </BotonFz>
      </template>
    </ModalFz>
  </div>
</template>

<style scoped>
.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fz-espaciado-compacto);
}

.acciones__texto {
  margin: 0;
}

.acciones__campo {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.acciones__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: var(--fz-peso-enfasis);
}
</style>
