<script setup lang="ts">
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { CampoFormularioFz, SelectFz } from '@/ui'

const props = defineProps<{
  procesando: boolean
  bloqueado?: boolean
  // El GERENTE elige la sede; el RECEPCION trabaja en la suya y no ve el selector.
  conSelectorSede: boolean
  sedes: Sede[]
  cargandoSedes: boolean
  // Id del <form>: el botón del pie del modal lo envía con el atributo `form`.
  idFormulario: string
}>()

const emit = defineEmits<{
  (e: 'enviar'): void
}>()

const sedeId = defineModel<string>('sedeId', { required: true })
const socioId = defineModel<string>('socioId', { required: true })
const codigoTotp = defineModel<string>('codigoTotp', { required: true })

function manejarEnvio() {
  if (props.procesando || props.bloqueado) return
  emit('enviar')
}
</script>

<template>
  <form :id="idFormulario" class="formulario-ingreso" novalidate @submit.prevent="manejarEnvio">
    <CampoFormularioFz v-if="conSelectorSede" etiqueta="Sede de acceso" etiqueta-chica obligatorio>
      <template #default="{ id, describedby }">
        <SelectFz
          :id="id"
          v-model="sedeId"
          name="sede"
          aria-required="true"
          :aria-describedby="describedby"
          :disabled="cargandoSedes || procesando"
        >
          <option v-for="sede in sedes" :key="sede.id" :value="String(sede.id)">{{ sede.nombre }}</option>
        </SelectFz>
      </template>
    </CampoFormularioFz>

    <CampoFormularioFz
      v-model="socioId"
      etiqueta="ID del socio"
      etiqueta-chica
      obligatorio
      name="socioId"
      tipo="number"
      min="1"
      placeholder="Ej: 1"
      ayuda="Es el número que figura en el carnet."
      :disabled="procesando || bloqueado"
    />

    <CampoFormularioFz
      v-model="codigoTotp"
      etiqueta="Código del carnet"
      etiqueta-chica
      obligatorio
      name="codigoTotp"
      tipo="text"
      maxlength="6"
      inputmode="numeric"
      placeholder="Ej: 123456"
      ayuda="Son los 6 dígitos que muestra el carnet."
      autocomplete="off"
      :disabled="procesando || bloqueado"
    />
  </form>
</template>

<style scoped>
.formulario-ingreso {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}
</style>
