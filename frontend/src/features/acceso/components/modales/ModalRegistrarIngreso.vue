<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { BotonFz, ModalFz } from '@/ui'
import { useRegistroIngreso } from '../../composables/useRegistroIngreso'
import type { Ingreso } from '../../services/servicioAcceso'
import FormularioIngreso from '../FormularioIngreso.vue'
import ResultadoIngreso from '../ResultadoIngreso.vue'

defineProps<{
  sedes: Sede[]
  cargandoSedes: boolean
}>()

const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ registrado: [ingreso: Ingreso] }>()

const idFormulario = useId()
const cuerpo = useTemplateRef<HTMLElement>('cuerpo')
const { sedeId: sedeDelToken } = useUsuarioSesion()

// El RECEPCION trabaja en la sede de su token (campo de solo lectura); el GERENTE arranca sin sede elegida, sin precargar la
// sede que se esté mirando.
const sedeBloqueada = computed(() => sedeDelToken.value !== null)
const sedeElegida = ref<number | null>(sedeDelToken.value)
// El formulario trabaja con el valor del select (texto); la sede elegida se guarda como número.
const sedeTexto = computed({
  get: () => (sedeElegida.value ? String(sedeElegida.value) : ''),
  set: (valor: string) => {
    sedeElegida.value = valor ? Number(valor) : null
  },
})

const { socioIdInput, codigoTotpInput, procesando, resultado, errores, registrar, reiniciarResultado } =
  useRegistroIngreso(sedeElegida)

// El foco va al primer campo a corregir; si no hay errores, al ID, que es lo que se escribe para el siguiente ingreso (su
// contenido queda seleccionado).
function enfocarCampo() {
  const nombre = errores.value.sedeId && !sedeBloqueada.value ? 'sede' : 'socioId'
  const campo = cuerpo.value?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${nombre}"]`)
  campo?.focus()
  if (campo instanceof HTMLInputElement) campo.select()
}

// Cada vez que se abre arranca limpio, sin sede elegida (salvo la del token) y sin el resultado de la vez anterior.
watch(abierto, async (valor) => {
  if (!valor) return
  sedeElegida.value = sedeDelToken.value
  socioIdInput.value = ''
  codigoTotpInput.value = ''
  reiniciarResultado()
  await nextTick()
  enfocarCampo()
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
  enfocarCampo()
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
        :sede-bloqueada="sedeBloqueada"
        :sedes="sedes"
        :cargando-sedes="cargandoSedes"
        :errores="errores"
        :procesando="procesando"
        @enviar="validar"
      />
      <ResultadoIngreso :resultado="resultado" />
    </div>

    <template #acciones="{ cerrar }">
      <BotonFz variante="secundario" :disabled="procesando" @click="cerrar">Cerrar</BotonFz>
      <BotonFz tipo="submit" :form="idFormulario" :cargando="procesando">
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
