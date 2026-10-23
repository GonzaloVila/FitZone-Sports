<script setup lang="ts">
import { PlantillaCentradaFz } from '@/ui'
import FormularioLogin from '../components/FormularioLogin.vue'
import { useIniciarSesion } from '../composables/useIniciarSesion'

const { iniciarSesion, cargando, error } = useIniciarSesion()
</script>

<template>
  <PlantillaCentradaFz titulo="FitZone Sports" subtitulo="Ingresá a tu cuenta">
    <FormularioLogin :cargando="cargando" :error="error ?? undefined" @enviar="iniciarSesion" />
  </PlantillaCentradaFz>
</template>
