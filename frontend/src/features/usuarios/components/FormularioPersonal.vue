<script setup lang="ts">
import { CampoContraseniaFz, CampoFormularioFz, SelectFz } from '@/ui'
import type { AltaPersonal } from '../composables/useAltaPersonal'

defineProps<{
  alta: AltaPersonal
  // Id del <form>: los botones del pie del modal lo envían con el atributo `form`.
  idFormulario: string
}>()

defineEmits<{
  (e: 'guardar'): void
}>()

const ayudaSede = (alta: AltaPersonal): string => {
  if (alta.cargandoSedes) return 'Cargando sedes libres…'
  if (alta.sedesDisponibles.length === 0) return 'No hay sedes libres: creá una sede antes de asignar un recepcionista.'
  return 'Una sede admite un solo recepcionista.'
}
</script>

<template>
  <form :id="idFormulario" class="formulario-personal" novalidate @submit.prevent="$emit('guardar')">
    <CampoFormularioFz
      v-model="alta.datos.nombre"
      etiqueta="Nombre y apellido"
      etiqueta-chica
      obligatorio
      name="nombre"
      autocomplete="name"
      data-primer-campo
      :error="alta.errores.nombre"
      :disabled="alta.enviando"
    />
    <CampoFormularioFz
      v-model="alta.datos.dni"
      etiqueta="DNI"
      etiqueta-chica
      obligatorio
      name="dni"
      inputmode="numeric"
      autocomplete="off"
      :error="alta.errores.dni"
      :disabled="alta.enviando"
    />
    <CampoFormularioFz
      v-model="alta.datos.email"
      etiqueta="Correo"
      etiqueta-chica
      obligatorio
      tipo="email"
      name="email"
      autocomplete="off"
      :error="alta.errores.email"
      :disabled="alta.enviando"
    />
    <CampoFormularioFz
      v-model="alta.datos.telefono"
      etiqueta="Teléfono (opcional)"
      etiqueta-chica
      tipo="tel"
      name="telefono"
      autocomplete="off"
      :error="alta.errores.telefono"
      :disabled="alta.enviando"
    />

    <CampoFormularioFz
      etiqueta="Sede de trabajo"
      etiqueta-chica
      obligatorio
      :ayuda="ayudaSede(alta)"
      :error="alta.errores.sedeId"
    >
      <template #default="{ id, describedby, invalido }">
        <SelectFz
          :id="id"
          v-model="alta.datos.sedeId"
          name="sedeId"
          :invalido="invalido"
          :aria-describedby="describedby"
          :disabled="alta.cargandoSedes || alta.enviando"
          aria-required="true"
        >
          <option value="">{{ alta.cargandoSedes ? 'Cargando sedes…' : 'Elegí una sede' }}</option>
          <option v-for="sede in alta.sedesDisponibles" :key="sede.id" :value="String(sede.id)">
            {{ sede.nombre }}
          </option>
        </SelectFz>
      </template>
    </CampoFormularioFz>

    <CampoContraseniaFz
      v-model="alta.datos.contrasenia"
      etiqueta="Contraseña"
      etiqueta-chica
      ayuda="Al menos 8 caracteres."
      obligatorio
      name="contrasenia"
      autocomplete="new-password"
      :error="alta.errores.contrasenia"
      :disabled="alta.enviando"
    />
  </form>
</template>

<style scoped>
.formulario-personal {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}
</style>
