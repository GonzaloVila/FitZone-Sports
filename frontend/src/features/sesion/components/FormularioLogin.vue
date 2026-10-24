<script setup lang="ts">
import { computed, ref } from 'vue'
import { AvisoFz, BotonFz, CampoContraseniaFz, CampoFormularioFz } from '@/ui'

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
  if (!valor) return 'Ingresá tu correo.'
  if (!FORMATO_EMAIL.test(valor)) return 'Ingresá un correo válido.'
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
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <CampoFormularioFz
      v-model="email"
      etiqueta="Correo electrónico"
      tipo="email"
      name="email"
      autocomplete="username"
      :error="errorEmail"
    />
    <CampoContraseniaFz
      v-model="contrasenia"
      etiqueta="Contraseña"
      name="contrasenia"
      autocomplete="current-password"
      :error="errorContrasenia"
    />
    <BotonFz tipo="submit" tamano="lg" class="formulario-login__enviar" :cargando="cargando">
      {{ cargando ? 'Ingresando…' : 'Ingresar' }}
    </BotonFz>
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
