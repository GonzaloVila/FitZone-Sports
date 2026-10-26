<script setup lang="ts">
import { useId, watch } from 'vue'
import { AvisoFz, BotonFz, ModalFz, useAvisosFz } from '@/ui'
import { useAltaSede } from '../../composables/useAltaSede'
import type { Sede } from '../../services/servicioSedes'
import FormularioSede from '../FormularioSede.vue'

const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ creada: [sede: Sede] }>()

const avisos = useAvisosFz()
const idFormulario = useId()
const { form, guardando, error, erroresValidacion, crear, reiniciar } = useAltaSede()

// Cada vez que se abre, el formulario arranca limpio.
watch(abierto, (valor) => {
  if (valor) reiniciar()
})

// Si sale bien: se cierra, avisa y le dice a quien lo abrió que hay una sede nueva (para recargar los selectores). La sede
// activa no cambia. Si falla, el modal sigue abierto con el error adentro (un aviso flotante quedaría detrás del <dialog>).
async function guardar() {
  const sede = await crear()
  if (!sede) return
  abierto.value = false
  avisos.exito('Sede creada', `${sede.nombre} · capacidad para ${sede.aforoMaximo} personas.`)
  emit('creada', sede)
}
</script>

<template>
  <ModalFz
    v-model="abierto"
    titulo="Nueva sede"
    descripcion="Cargá los datos de la sede."
    icono="mas"
    tono="primario"
    :ocupado="guardando"
  >
    <FormularioSede
      :form="form"
      :guardando="guardando"
      :errores="erroresValidacion"
      :id-formulario="idFormulario"
      @guardar="guardar"
    />
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <template #acciones="{ cerrar }">
      <BotonFz variante="fantasma" @click="cerrar">Cancelar</BotonFz>
      <BotonFz tipo="submit" :form="idFormulario" :cargando="guardando">Guardar</BotonFz>
    </template>
  </ModalFz>
</template>
