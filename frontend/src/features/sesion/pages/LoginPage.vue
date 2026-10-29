<script setup lang="ts">
import { MarcaFz, PlantillaCentradaFz } from '@/ui'
import FormularioLogin from '../components/FormularioLogin.vue'
import { useIniciarSesion } from '../composables/useIniciarSesion'

const { iniciarSesion, cargando, error } = useIniciarSesion()
</script>

<template>
  <PlantillaCentradaFz titulo="Iniciar sesión" subtitulo="Ingresá tus credenciales para acceder.">
    <template #marca>
      <MarcaFz nombre="FitZone Sports" descripcion="Gestión de Clubes y Sedes Deportivas" logo-url="/logofzsvg.svg" />
    </template>
    <FormularioLogin :cargando="cargando" :error="error ?? undefined" @enviar="iniciarSesion" />
  </PlantillaCentradaFz>
</template>
