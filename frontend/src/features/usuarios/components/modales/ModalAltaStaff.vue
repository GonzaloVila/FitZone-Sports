<script setup lang="ts">
import { reactive, useId, watch } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { AvisoFz, BotonFz, ModalFz, useAvisosFz } from '@/ui'
import { useAltaStaff } from '../../composables/useAltaStaff'
import type { Usuario } from '../../services/servicioUsuarios'
import FormularioStaff from '../FormularioStaff.vue'

const props = defineProps<{ sedes: readonly Sede[] }>()

const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ creado: [usuario: Usuario] }>()

const avisos = useAvisosFz()
const idFormulario = useId()
const alta = reactive(useAltaStaff(() => props.sedes))

// Cada vez que se abre, el formulario arranca limpio y se refrescan las sedes
// libres (otra sesión pudo haber asignado una mientras tanto).
watch(abierto, (valor) => {
  if (!valor) return
  alta.reiniciar()
  void alta.cargarSedesOcupadas()
})

async function guardar() {
  const creado = await alta.crear()
  if (!creado) return

  const sede = props.sedes.find((candidata) => String(candidata.id) === alta.datos.sedeId)?.nombre
  abierto.value = false
  avisos.exito('Recepcionista creado', `${creado.nombre}${sede ? ` · ${sede}` : ''}.`)
  emit('creado', creado)
}
</script>

<template>
  <ModalFz
    v-model="abierto"
    titulo="Nuevo recepcionista"
    descripcion="Cargá los datos del recepcionista y la sede donde va a trabajar."
    icono="equipo"
    tono="primario"
    :ocupado="alta.enviando"
  >
    <form :id="idFormulario" novalidate @submit.prevent="guardar">
      <FormularioStaff :alta="alta" />
      <AvisoFz v-if="alta.errorGeneral" variante="peligro" class="modal-alta-staff__error">
        {{ alta.errorGeneral }}
      </AvisoFz>
    </form>

    <template #acciones="{ cerrar }">
      <BotonFz variante="fantasma" @click="cerrar">Cancelar</BotonFz>
      <BotonFz tipo="submit" :form="idFormulario" :cargando="alta.enviando">Crear</BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.modal-alta-staff__error {
  margin-top: var(--fz-espaciado-base);
}
</style>
