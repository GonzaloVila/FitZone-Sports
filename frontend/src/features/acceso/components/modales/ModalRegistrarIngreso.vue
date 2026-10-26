<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { BotonFz, ModalFz } from '@/ui'
import { useRegistroIngreso } from '../../composables/useRegistroIngreso'
import type { Ingreso } from '../../services/servicioAcceso'
import FormularioIngreso from '../FormularioIngreso.vue'
import ResultadoIngreso from '../ResultadoIngreso.vue'

const props = defineProps<{
  sedes: Sede[]
  // Sede con la que abre el modal; el selector propio no cambia la sede activa de la pantalla.
  sedeInicial: number | null
  // El GERENTE elige la sede; el RECEPCION trabaja en la suya y no ve el selector.
  conSelectorSede: boolean
  cargandoSedes: boolean
}>()

const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ registrado: [ingreso: Ingreso] }>()

const idFormulario = useId()
const cuerpo = useTemplateRef<HTMLElement>('cuerpo')

const sedeElegida = ref<number | null>(props.sedeInicial)
// El formulario trabaja con el valor del select (texto); la sede elegida se guarda como número.
const sedeTexto = computed({
  get: () => (sedeElegida.value ? String(sedeElegida.value) : ''),
  set: (valor: string) => {
    sedeElegida.value = valor ? Number(valor) : null
  },
})

const { socioIdInput, codigoTotpInput, procesando, resultado, registrar, reiniciarResultado } = useRegistroIngreso(sedeElegida)

const faltanDatos = computed(() => !sedeElegida.value || !socioIdInput.value || !codigoTotpInput.value)

// El foco vuelve al campo de ID: es lo que se escribe para el siguiente ingreso (su contenido queda seleccionado).
function enfocarId() {
  const campo = cuerpo.value?.querySelector<HTMLInputElement>('input[name="socioId"]')
  campo?.focus()
  campo?.select()
}

// Cada vez que se abre arranca limpio, con la sede inicial y sin el resultado de la vez anterior.
watch(abierto, async (valor) => {
  if (!valor) return
  sedeElegida.value = props.sedeInicial
  socioIdInput.value = ''
  codigoTotpInput.value = ''
  reiniciarResultado()
  await nextTick()
  enfocarId()
})

// Validar NO cierra el modal: muestra el resultado y deja todo listo para el siguiente. El código se borra siempre (lo
// hace el composable); el ID se borra solo si el ingreso se permitió (si se denegó, puede reintentarse con el mismo).
async function validar() {
  await registrar({
    alExito: (ingreso) => {
      socioIdInput.value = ''
      emit('registrado', ingreso)
    },
  })
  await nextTick()
  enfocarId()
}
</script>

<template>
  <ModalFz
    v-model="abierto"
    titulo="Registrar ingreso"
    descripcion="Validá la membresía de un socio y dejá registrado su ingreso."
    icono="acceso"
    tono="primario"
    :ocupado="procesando"
  >
    <div ref="cuerpo" class="cuerpo">
      <FormularioIngreso
        v-model:sede-id="sedeTexto"
        v-model:socio-id="socioIdInput"
        v-model:codigo-totp="codigoTotpInput"
        :id-formulario="idFormulario"
        :con-selector-sede="conSelectorSede"
        :sedes="sedes"
        :cargando-sedes="cargandoSedes"
        :procesando="procesando"
        :bloqueado="!sedeElegida"
        @enviar="validar"
      />
      <ResultadoIngreso :resultado="resultado" />
    </div>

    <template #acciones="{ cerrar }">
      <BotonFz variante="secundario" :disabled="procesando" @click="cerrar">Cerrar</BotonFz>
      <BotonFz tipo="submit" :form="idFormulario" :cargando="procesando" :disabled="faltanDatos">
        {{ procesando ? 'Validando…' : 'Validar e ingresar' }}
      </BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.cuerpo {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}
</style>
