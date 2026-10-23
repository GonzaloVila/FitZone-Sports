<script setup lang="ts">
import { PlantillaCentradaFz } from '@/ui'
import FormularioLogin from '../components/FormularioLogin.vue'

function manejarEnvio() {
  // Por ahora no hace nada: la conexión con el servicio de sesión se hace en SCRUM-16.
}
</script>

<template>
  <PlantillaCentradaFz titulo="FitZone Sports" subtitulo="Ingresá a tu cuenta">
    <FormularioLogin @enviar="manejarEnvio" />
  </PlantillaCentradaFz>
</template>
