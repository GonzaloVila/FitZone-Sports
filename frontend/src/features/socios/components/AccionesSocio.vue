<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { AvisoFz, BotonFz, ModalFz, SelectFz } from '@/ui'
import { accionPermitida } from '../presentacion'
import type { Membresia, Plan } from '../services/servicioSocios'
import type { AccionConModal, AccionSocio, SocioResumen } from '../tipos'
import ModalesAccionSocio from './modales/ModalesAccionSocio.vue'

const props = defineProps<{
  socio: SocioResumen
  // null = la membresía no está disponible (cargando o falló).
  membresia: Membresia | null
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
const sedeElegida = ref('')
const idSede = useId()

const estado = computed(() => props.membresia?.estado ?? null)
const ocupado = computed(() => props.ejecutando !== null)
const renuevaAutomatica = computed(() => props.membresia?.renuevaAutomatica ?? false)

// Cambiar plan, suspender, reactivar y dejar de ser socio comparten los modales de ModalesAccionSocio (los mismos
// que usa la lista); renovación automática y cambiar sede tienen el suyo, acá abajo.
const accionConModal = computed<AccionConModal | null>(() => {
  const actual = accion.value
  return actual === 'cambiar-plan' || actual === 'suspender' || actual === 'reactivar' || actual === 'dejar-de-ser-socio' ? actual : null
})
const propioAbierto = computed({
  get: () => accion.value === 'renovacion-automatica' || accion.value === 'cambiar-sede',
  set: (valor) => {
    if (!valor) accion.value = null
  },
})

function abrir(nueva: AccionSocio) {
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

const sedeNueva = computed(() => Number(sedeElegida.value))
const sedeCambio = computed(() => Number.isInteger(sedeNueva.value) && sedeNueva.value !== props.sedeActualId)

function confirmarPropio() {
  if (accion.value === 'renovacion-automatica') emit('alternarRenovacion')
  else if (accion.value === 'cambiar-sede' && sedeCambio.value) emit('cambiarSede', sedeNueva.value)
}
</script>

<template>
  <div class="acciones">
    <BotonFz v-if="accionPermitida('suspender', estado)" variante="secundario" @click="abrir('suspender')">Suspender</BotonFz>
    <BotonFz v-if="accionPermitida('reactivar', estado)" variante="secundario" @click="abrir('reactivar')">Reactivar</BotonFz>
    <BotonFz
      v-if="membresia"
      variante="secundario"
      :disabled="!accionPermitida('cambiar-plan', estado)"
      @click="abrir('cambiar-plan')"
    >
      {{ estado === 'VENCIDA' ? 'Renovar' : 'Cambiar plan' }}
    </BotonFz>
    <BotonFz v-if="membresia" variante="secundario" @click="abrir('renovacion-automatica')">
      {{ renuevaAutomatica ? 'Desactivar renovación automática' : 'Activar renovación automática' }}
    </BotonFz>
    <BotonFz variante="secundario" @click="abrir('cambiar-sede')">Cambiar sede de origen</BotonFz>
    <BotonFz variante="peligro" @click="abrir('dejar-de-ser-socio')">Dejar de ser socio</BotonFz>

    <ModalesAccionSocio
      :accion="accionConModal"
      :socio="socio"
      :membresia="membresia"
      :ejecutando="ocupado"
      :error="error"
      @cerrar="accion = null"
      @confirmar-plan="emit('cambiarPlan', $event)"
      @suspender="emit('suspender')"
      @reactivar="emit('reactivar')"
      @dejar-de-ser-socio="emit('dejarDeSerSocio')"
    />

    <ModalFz v-model="propioAbierto" :titulo="accion === 'cambiar-sede' ? 'Cambiar la sede de origen' : 'Renovación automática'" :ocupado="ocupado">
      <div v-if="accion === 'cambiar-sede'" class="acciones__campo">
        <label :for="idSede" class="acciones__etiqueta">Sede de origen</label>
        <SelectFz :id="idSede" v-model="sedeElegida" :disabled="ocupado">
          <option v-for="sede in sedes" :key="sede.id" :value="String(sede.id)">{{ sede.nombre }}</option>
        </SelectFz>
      </div>
      <p v-else class="acciones__texto">
        {{ renuevaAutomatica ? 'La membresía dejará de renovarse sola al vencer.' : 'La membresía se renovará sola al vencer.' }}
      </p>
      <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
      <template #acciones="{ cerrar }">
        <BotonFz variante="secundario" :disabled="ocupado" @click="cerrar">Cancelar</BotonFz>
        <BotonFz :cargando="ocupado" :disabled="accion === 'cambiar-sede' && !sedeCambio" @click="confirmarPropio">
          {{ accion === 'cambiar-sede' ? 'Cambiar sede' : renuevaAutomatica ? 'Desactivar' : 'Activar' }}
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
