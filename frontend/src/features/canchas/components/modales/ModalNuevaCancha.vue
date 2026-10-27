<script setup lang="ts">
import { useId, watch } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { AvisoFz, BotonFz, ModalFz, useAvisosFz } from '@/ui'
import { useAltaCancha } from '../../composables/useAltaCancha'
import { ETIQUETA_TIPO_CANCHA } from '../../presentacion'
import type { Cancha } from '../../services/servicioCanchas'
import FormularioCancha from '../FormularioCancha.vue'

const props = defineProps<{
  sedes: Sede[]
}>()

const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ creada: [cancha: Cancha] }>()

const avisos = useAvisosFz()
const idFormulario = useId()
const { form, guardando, error, errores, crear, reiniciar } = useAltaCancha()

// Cada vez que se abre, el formulario arranca limpio: la sede y el deporte sin elegir.
watch(abierto, (valor) => {
  if (valor) reiniciar()
})

function nombreDeSede(id: number): string {
  return props.sedes.find((sede) => sede.id === id)?.nombre ?? `Sede ${id}`
}

// Si sale bien: se cierra, avisa y le dice a quien lo abrió que hay una cancha nueva (para recargar la lista). Si falla, el
// modal sigue abierto con el error adentro (un aviso flotante quedaría detrás del <dialog>).
async function guardar() {
  const cancha = await crear()
  if (!cancha) return
  abierto.value = false
  avisos.exito('Cancha creada', `${ETIQUETA_TIPO_CANCHA[cancha.tipo]} · ${nombreDeSede(cancha.sedeId)}`)
  emit('creada', cancha)
}
</script>

<template>
  <ModalFz
    v-model="abierto"
    titulo="Nueva cancha"
    descripcion="Cargá una cancha con su sede, deporte y costo por hora."
    icono="mas"
    tono="primario"
    :ocupado="guardando"
  >
    <FormularioCancha
      :form="form"
      :sedes="sedes"
      :guardando="guardando"
      :errores="errores"
      :id-formulario="idFormulario"
      @guardar="guardar"
    />
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <template #acciones="{ cerrar }">
      <BotonFz variante="fantasma" :disabled="guardando" @click="cerrar">Cancelar</BotonFz>
      <BotonFz tipo="submit" :form="idFormulario" :cargando="guardando">
        {{ guardando ? 'Creando cancha…' : 'Crear cancha' }}
      </BotonFz>
    </template>
  </ModalFz>
</template>
