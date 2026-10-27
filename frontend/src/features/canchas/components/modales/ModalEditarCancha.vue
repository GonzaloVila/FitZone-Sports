<script setup lang="ts">
import { computed, useId, watch } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { AvisoFz, BotonFz, CampoFormularioFz, ModalFz, SelectFz, useAvisosFz } from '@/ui'
import { useEditarCancha } from '../../composables/useEditarCancha'
import { nombreDeCancha, resumenDeCambios } from '../../edicion'
import { ESTADOS_CANCHA, ETIQUETA_ESTADO_CANCHA } from '../../presentacion'
import type { Cancha } from '../../services/servicioCanchas'

const props = defineProps<{
  sedes: Sede[]
  // La cancha que se edita (la de la fila elegida); null mientras no hay ninguna.
  cancha: Cancha | null
}>()

const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ guardada: [cancha: Cancha] }>()

const avisos = useAvisosFz()
const idFormulario = useId()
const { form, guardando, error, errores, iniciar, guardar } = useEditarCancha()

// Cada vez que se abre, el formulario arranca con los valores actuales de la cancha.
watch(abierto, (valor) => {
  if (valor && props.cancha) iniciar(props.cancha)
})

const nombreDeSede = computed(() => {
  const id = props.cancha?.sedeId
  return props.sedes.find((sede) => sede.id === id)?.nombre ?? (id === undefined ? '' : `Sede ${id}`)
})

const descripcion = computed(() =>
  props.cancha ? `${nombreDeCancha(props.cancha)} · ${nombreDeSede.value}` : 'Cambiá el costo por hora o el estado de la cancha.',
)

// Si sale bien: se cierra, dice qué cambió y le avisa a quien lo abrió (para recargar la lista). Si falla, el modal sigue
// abierto con el error adentro (un aviso flotante quedaría detrás del <dialog>).
async function enviar() {
  const antes = props.cancha
  const despues = await guardar()
  if (!antes || !despues) return
  abierto.value = false
  const resumen = resumenDeCambios(antes, despues)
  avisos.exito(resumen.titulo, resumen.descripcion)
  emit('guardada', despues)
}
</script>

<template>
  <ModalFz v-model="abierto" titulo="Editar cancha" :descripcion="descripcion" icono="editar" tono="primario" :ocupado="guardando">
    <form :id="idFormulario" class="formulario-edicion" novalidate @submit.prevent="enviar">
      <CampoFormularioFz
        v-model="form.costoPorHora"
        etiqueta="Costo por hora"
        etiqueta-chica
        obligatorio
        tipo="number"
        name="costoPorHora"
        min="0"
        step="0.01"
        autocomplete="off"
        :error="errores.costoPorHora"
        :disabled="guardando"
      />

      <CampoFormularioFz
        etiqueta="Estado"
        etiqueta-chica
        obligatorio
        ayuda="En mantenimiento no se reservan turnos nuevos; las reservas ya tomadas se mantienen."
        :error="errores.estado"
      >
        <template #default="{ id, describedby, invalido }">
          <SelectFz
            :id="id"
            v-model="form.estado"
            name="estado"
            aria-required="true"
            :invalido="invalido"
            :aria-describedby="describedby"
            :disabled="guardando"
          >
            <option v-for="valor in ESTADOS_CANCHA" :key="valor" :value="valor">{{ ETIQUETA_ESTADO_CANCHA[valor] }}</option>
          </SelectFz>
        </template>
      </CampoFormularioFz>
    </form>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <template #acciones="{ cerrar }">
      <BotonFz variante="fantasma" :disabled="guardando" @click="cerrar">Cancelar</BotonFz>
      <BotonFz tipo="submit" :form="idFormulario" :cargando="guardando">
        {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
      </BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.formulario-edicion {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}
</style>
