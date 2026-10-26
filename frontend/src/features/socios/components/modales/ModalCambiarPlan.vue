<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AvisoFz, BotonFz, ModalFz, OpcionesTarjetaFz } from '@/ui'
import { OPCIONES_PLAN, PLANES, puedeConfirmarPlan } from '../../presentacion'
import type { Membresia, Plan } from '../../services/servicioSocios'
import type { SocioResumen } from '../../tipos'
import ResumenSocio from './ResumenSocio.vue'

const props = defineProps<{
  socio: SocioResumen
  membresia: Membresia | null
  ejecutando: boolean
  error: string | null
}>()

const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ confirmar: [plan: Plan] }>()

const renueva = computed(() => props.membresia?.estado === 'VENCIDA')
const planElegido = ref<string>(props.membresia?.plan ?? '')

// Al abrir, queda elegido el plan actual.
watch(abierto, (valor) => {
  if (valor) planElegido.value = props.membresia?.plan ?? ''
})

const puedeConfirmar = computed(
  () => puedeConfirmarPlan(props.membresia?.estado ?? null, props.membresia?.plan ?? null, planElegido.value),
)

function confirmar() {
  const plan = PLANES.find((candidato) => candidato === planElegido.value)
  if (plan && puedeConfirmar.value) emit('confirmar', plan)
}
</script>

<template>
  <ModalFz v-model="abierto" :titulo="renueva ? 'Renovar membresía' : 'Cambiar plan'" icono="cambiar" tono="primario" :ocupado="ejecutando">
    <ResumenSocio :socio="socio" :membresia="membresia" />
    <OpcionesTarjetaFz v-model="planElegido" nombre="plan" leyenda="Plan nuevo" :opciones="OPCIONES_PLAN" :deshabilitado="ejecutando" />
    <p class="nota">
      {{
        renueva
          ? 'Se cobrará el plan nuevo y la membresía volverá a estar activa desde hoy.'
          : 'Abre un período nuevo desde hoy; los días que quedaban del anterior no se trasladan.'
      }}
    </p>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <template #acciones="{ cerrar }">
      <BotonFz variante="secundario" :disabled="ejecutando" @click="cerrar">Cancelar</BotonFz>
      <BotonFz :cargando="ejecutando" :disabled="!puedeConfirmar" @click="confirmar">
        {{ renueva ? 'Renovar' : 'Cambiar plan' }}
      </BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.nota {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
