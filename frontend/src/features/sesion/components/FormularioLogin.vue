<script setup lang="ts">
import { computed, ref } from 'vue'
import { AvisoFz, BotonFz, CampoFormularioFz } from '@/ui'

defineProps<{
  cargando?: boolean
  error?: string
}>()

const emit = defineEmits<{
  enviar: [datos: { email: string; contrasenia: string }]
}>()

// Formato razonable de email: solo ayuda de UX, la validación real la hace el backend.
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const email = ref('')
const contrasenia = ref('')
// Los errores se muestran recién después del primer intento de envío.
const intentoEnvio = ref(false)

const errorEmail = computed(() => {
  if (!intentoEnvio.value) return undefined
  const valor = email.value.trim()
  if (!valor) return 'Ingresá tu email.'
  if (!FORMATO_EMAIL.test(valor)) return 'Ingresá un email válido.'
  return undefined
})

const errorContrasenia = computed(() => {
  if (!intentoEnvio.value) return undefined
  return contrasenia.value ? undefined : 'Ingresá tu contraseña.'
})

function enviar() {
  intentoEnvio.value = true
  if (errorEmail.value || errorContrasenia.value) return
  emit('enviar', { email: email.value.trim(), contrasenia: contrasenia.value })
}
</script>

<template>
  <form class="formulario-login" novalidate @submit.prevent="enviar">
    <CampoFormularioFz
      v-model="email"
      etiqueta="Email"
      tipo="email"
      name="email"
      autocomplete="username"
      :error="errorEmail"
    />
    <CampoFormularioFz
      v-model="contrasenia"
      etiqueta="Contraseña"
      tipo="password"
      name="contrasenia"
      autocomplete="current-password"
      :error="errorContrasenia"
    />
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <BotonFz tipo="submit" class="formulario-login__enviar" :cargando="cargando">Ingresar</BotonFz>
  </form>
</template>

<style scoped>
.formulario-login {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.formulario-login__enviar {
  width: 100%;
}
</style>
