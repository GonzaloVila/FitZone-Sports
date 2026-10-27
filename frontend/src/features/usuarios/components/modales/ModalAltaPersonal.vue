<script setup lang="ts">
import { reactive, useId, watch } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { AvisoFz, BotonFz, ModalFz, useAvisosFz } from '@/ui'
import { useAltaPersonal } from '../../composables/useAltaPersonal'
import type { Usuario } from '../../services/servicioUsuarios'
import FormularioPersonal from '../FormularioPersonal.vue'

const props = defineProps<{ sedes: readonly Sede[] }>()

const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ creado: [usuario: Usuario] }>()

const avisos = useAvisosFz()
const idFormulario = useId()
const alta = reactive(useAltaPersonal(() => props.sedes))

// Cada vez que se abre, el formulario arranca limpio y se refrescan las sedes libres (otra sesión pudo haber asignado una
// mientras tanto).
watch(abierto, (valor) => {
  if (!valor) return
  alta.reiniciar()
  void alta.cargarSedesOcupadas()
})

// Si sale bien: se cierra, avisa y le dice a quien lo abrió que hay un recepcionista nuevo (para recargar el listado). Si
// falla, el modal sigue abierto con el error adentro (un aviso flotante quedaría detrás del <dialog>).
async function guardar() {
  const creado = await alta.crear()
  if (!creado) return

  const sede = props.sedes.find((candidata) => String(candidata.id) === alta.datos.sedeId)?.nombre
  abierto.value = false
  avisos.exito('Recepcionista creado', `${creado.nombre}${sede ? ` · ${sede}` : ''}`)
  emit('creado', creado)
}
</script>

<template>
  <ModalFz
    v-model="abierto"
    titulo="Nuevo recepcionista"
    descripcion="Cargá los datos del recepcionista y la sede donde va a trabajar."
    icono="mas"
    tono="primario"
    :ocupado="alta.enviando"
  >
    <FormularioPersonal :alta="alta" :id-formulario="idFormulario" @guardar="guardar" />
    <AvisoFz v-if="alta.errorGeneral" variante="peligro">{{ alta.errorGeneral }}</AvisoFz>

    <template #acciones="{ cerrar }">
      <BotonFz variante="fantasma" :disabled="alta.enviando" @click="cerrar">Cancelar</BotonFz>
      <BotonFz tipo="submit" :form="idFormulario" :cargando="alta.enviando">
        {{ alta.enviando ? 'Creando recepcionista…' : 'Crear recepcionista' }}
      </BotonFz>
    </template>
  </ModalFz>
</template>
