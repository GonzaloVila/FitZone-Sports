<script setup lang="ts">
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { CampoFormularioFz, SelectFz } from '@/ui'
import type { ErroresIngreso } from '../validacionIngreso'

const props = defineProps<{
  procesando: boolean
  // El RECEPCION trabaja en la sede de su token: el campo queda de solo lectura con su valor. El GERENTE elige.
  sedeBloqueada: boolean
  sedes: Sede[]
  cargandoSedes: boolean
  errores: ErroresIngreso
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
  if (props.procesando) return
  emit('enviar')
}
</script>

<template>
  <form :id="idFormulario" class="formulario-ingreso" novalidate @submit.prevent="manejarEnvio">
    <CampoFormularioFz etiqueta="Sede de acceso" etiqueta-chica obligatorio :error="errores.sedeId">
      <template #default="{ id, describedby, invalido }">
        <SelectFz
          :id="id"
          v-model="sedeId"
          name="sede"
          aria-required="true"
          :invalido="invalido"
          :aria-describedby="describedby"
          :disabled="cargandoSedes || procesando || sedeBloqueada"
        >
          <option value="" disabled>{{ cargandoSedes ? 'Cargando sedes…' : 'Elegí una sede' }}</option>
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
      :error="errores.socioId"
      :disabled="procesando"
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
      :error="errores.codigoTotp"
      :disabled="procesando"
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
