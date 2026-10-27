<script setup lang="ts">
import { computed, useId, watch } from 'vue'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { AvisoFz, BotonFz, ModalFz, useAvisosFz } from '@/ui'
import { useAltaClase } from '../../composables/useAltaClase'
import type { Clase } from '../../services/servicioClases'
import FormularioClase from '../FormularioClase.vue'

const props = defineProps<{
  sedes: Sede[]
}>()

const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ creada: [clase: Clase] }>()

const avisos = useAvisosFz()
const idFormulario = useId()
const { sedeId } = useUsuarioSesion()
const { form, guardando, error, errores, crear, reiniciar } = useAltaClase()

// RECEPCION tiene sede fija; el GERENTE (sedeId null) elige.
const sedeBloqueada = computed(() => sedeId.value !== null)

// Cada vez que se abre, el formulario arranca limpio: el GERENTE sin sede elegida y el RECEPCION en la suya.
watch(abierto, (valor) => {
  if (valor) reiniciar()
})

function nombreDeSede(id: number): string {
  return props.sedes.find((sede) => sede.id === id)?.nombre ?? `Sede ${id}`
}

// Si sale bien: se cierra, avisa y le dice a quien lo abrió que hay una clase nueva (para recargar la agenda). Si falla, el
// modal sigue abierto con el error adentro (un aviso flotante quedaría detrás del <dialog>).
async function guardar() {
  const clase = await crear()
  if (!clase) return
  abierto.value = false
  avisos.exito('Clase creada', `${clase.tipo} · ${nombreDeSede(clase.sedeId)}`)
  emit('creada', clase)
}
</script>

<template>
  <ModalFz
    v-model="abierto"
    titulo="Nueva clase"
    descripcion="Cargá una clase grupal con su sede, instructor, horario y cupo."
    icono="mas"
    tono="primario"
    :ocupado="guardando"
  >
    <FormularioClase
      :form="form"
      :sedes="sedes"
      :guardando="guardando"
      :errores="errores"
      :sede-bloqueada="sedeBloqueada"
      :id-formulario="idFormulario"
      @guardar="guardar"
    />
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <template #acciones="{ cerrar }">
      <BotonFz variante="fantasma" :disabled="guardando" @click="cerrar">Cancelar</BotonFz>
      <BotonFz tipo="submit" :form="idFormulario" :cargando="guardando">
        {{ guardando ? 'Creando clase…' : 'Crear clase' }}
      </BotonFz>
    </template>
  </ModalFz>
</template>
