<script setup lang="ts">
import { CampoFormularioFz } from '@/ui'
import type { AltaSocio } from '../../../composables/useAltaSocio'

defineProps<{ alta: AltaSocio }>()
</script>

<template>
  <div class="formulario">
    <CampoFormularioFz
      v-model="alta.datosNuevo.nombre"
      etiqueta="Nombre y apellido"
      etiqueta-chica
      obligatorio
      name="nombre"
      autocomplete="name"
      data-primer-campo
      :error="alta.errores.nombre"
    />
    <CampoFormularioFz
      v-model="alta.datosNuevo.dni"
      etiqueta="DNI"
      etiqueta-chica
      obligatorio
      name="dni"
      inputmode="numeric"
      autocomplete="off"
      :error="alta.errores.dni"
    />
    <CampoFormularioFz
      v-model="alta.datosNuevo.telefono"
      etiqueta="Teléfono (opcional)"
      etiqueta-chica
      tipo="tel"
      name="telefono"
      autocomplete="off"
      :error="alta.errores.telefono"
    />
    <CampoFormularioFz
      v-model="alta.datosNuevo.email"
      etiqueta="Correo"
      etiqueta-chica
      obligatorio
      tipo="email"
      name="email"
      autocomplete="off"
      :error="alta.errores.email"
    />
    <div class="formulario__ancho">
      <CampoFormularioFz
        v-model="alta.datosNuevo.contrasenia"
        etiqueta="Contraseña"
        etiqueta-chica
        obligatorio
        ayuda="Al menos 8 caracteres."
        tipo="password"
        name="contrasenia"
        autocomplete="new-password"
        :error="alta.errores.contrasenia"
      />
    </div>
  </div>
</template>

<style scoped>
/* Dos columnas (una sola en un modal angosto); la contraseña ocupa la fila entera. */
.formulario {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--fz-espaciado-base);
}

.formulario__ancho {
  grid-column: 1 / -1;
}
</style>
