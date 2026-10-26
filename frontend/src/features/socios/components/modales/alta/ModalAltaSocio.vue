<script setup lang="ts">
import { computed, reactive, useId, watch } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { AvisoFz, BotonFz, IconoFz, ModalFz, PestanasFz, useAvisosFz, type PestanaFz } from '@/ui'
import { useAltaSocio } from '../../../composables/useAltaSocio'
import type { Socio } from '../../../services/servicioSocios'
import PasoDatosUsuario from './PasoDatosUsuario.vue'
import PasoPlan from './PasoPlan.vue'

const props = defineProps<{ sedes: Sede[] }>()

const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ creado: [socio: Socio] }>()

// `reactive` desenvuelve los refs del composable: los pasos lo reciben como un solo objeto.
const alta = reactive(useAltaSocio())
const avisos = useAvisosFz()
const idFormulario = useId()

const pestanas: PestanaFz[] = [
  { id: 'datos', etiqueta: '1 Datos del usuario' },
  { id: 'plan', etiqueta: '2 Plan de membresía' },
]

// Las pestañas no cambian el paso por su cuenta: pedir la 2 (clic o flechas) con el paso 1 incompleto pasa por la
// misma validación que "Continuar al plan", muestra los errores y no avanza. Volver a la 1 siempre se puede.
const pestanaActiva = computed<string>({
  get: () => alta.paso,
  set: (id) => {
    if (!alta.enviando) alta.irAPaso(id === 'plan' ? 'plan' : 'datos')
  },
})

// Cada vez que se abre, el formulario arranca vacío en el paso 1.
watch(abierto, (valor) => {
  if (valor) alta.reiniciar()
})

const nombreSede = computed(() => props.sedes.find((sede) => String(sede.id) === alta.sede)?.nombre ?? '')

// Enter en un campo o el botón principal: en el paso 1 avanza (si es válido) y en el 2 da de alta.
async function alEnviarFormulario() {
  if (alta.enviando) return
  if (alta.paso === 'datos') {
    alta.continuar()
    return
  }
  const socio = await alta.enviar()
  if (!socio) return
  abierto.value = false
  avisos.exito('Socio dado de alta', socio.nombre)
  emit('creado', socio)
}
</script>

<template>
  <ModalFz
    v-model="abierto"
    titulo="Nuevo socio"
    descripcion="Cargá los datos del usuario y elegí su plan de membresía."
    icono="mas"
    tono="primario"
    ancho="amplio"
    :ocupado="alta.enviando"
  >
    <form :id="idFormulario" class="alta" novalidate @submit.prevent="alEnviarFormulario">
      <PestanasFz v-model="pestanaActiva" :pestanas="pestanas" etiqueta="Pasos del alta">
        <template #panel-datos><PasoDatosUsuario :alta="alta" :sedes="sedes" /></template>
        <template #panel-plan><PasoPlan :alta="alta" :nombre-sede="nombreSede" /></template>
      </PestanasFz>
      <AvisoFz v-if="alta.errorGeneral" variante="peligro">{{ alta.errorGeneral }}</AvisoFz>
    </form>

    <template #acciones="{ cerrar }">
      <template v-if="alta.paso === 'datos'">
        <BotonFz variante="fantasma" @click="cerrar">Cancelar</BotonFz>
        <BotonFz tipo="submit" :form="idFormulario">
          Continuar al plan
          <IconoFz nombre="flecha-derecha" tamano="sm" />
        </BotonFz>
      </template>
      <template v-else>
        <BotonFz class="alta__volver" variante="secundario" :disabled="alta.enviando" @click="alta.volver">
          <IconoFz nombre="flecha-izquierda" tamano="sm" />
          Volver a datos
        </BotonFz>
        <BotonFz tipo="submit" :form="idFormulario" :cargando="alta.enviando">
          <IconoFz nombre="tilde" tamano="sm" />
          Dar de alta
        </BotonFz>
      </template>
    </template>
  </ModalFz>
</template>

<style scoped>
.alta {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

/* "Volver a datos" a la izquierda del pie; el resto de los botones quedan a la derecha. */
.alta__volver {
  margin-right: auto;
}
</style>
