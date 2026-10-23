<script setup lang="ts">
import { BotonFz, CampoFormularioFz } from '@/ui'

const props = defineProps<{
  procesando: boolean
  bloqueado?: boolean
}>()

const emit = defineEmits<{
  (e: 'enviar'): void
}>()

const socioId = defineModel<string>('socioId', { required: true })
const codigoTotp = defineModel<string>('codigoTotp', { required: true })

function manejarEnvio() {
  if (props.procesando || props.bloqueado) return
  emit('enviar')
}
</script>

<template>
  <form class="formulario-ingreso" @submit.prevent="manejarEnvio">
    <div class="formulario-ingreso__campos">
      <CampoFormularioFz
        v-model="socioId"
        etiqueta="ID del Socio"
        name="socioId"
        tipo="number"
        min="1"
        ayuda="Número de socio o leído de la credencial"
        placeholder="Ej: 1"
        :disabled="procesando || bloqueado"
        required
      />

      <CampoFormularioFz
        v-model="codigoTotp"
        etiqueta="Código TOTP / QR dinámico"
        name="codigoTotp"
        tipo="text"
        maxlength="6"
        ayuda="6 dígitos del carnet o escáner (o código simulado de 6 dígitos)"
        placeholder="Ej: 123456"
        :disabled="procesando || bloqueado"
        autocomplete="off"
        required
      />
    </div>

    <div class="formulario-ingreso__acciones">
      <BotonFz
        variante="primario"
        tipo="submit"
        :cargando="procesando"
        :disabled="procesando || bloqueado || !socioId || !codigoTotp"
      >
        {{ procesando ? 'Validando…' : 'Validar e Ingresar' }}
      </BotonFz>
    </div>
  </form>
</template>

<style scoped>
.formulario-ingreso {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  background: var(--fz-color-fondo);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  padding: var(--fz-espaciado-amplio);
}

.formulario-ingreso__campos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--fz-espaciado-base);
}

@media (max-width: 640px) {
  .formulario-ingreso__campos {
    grid-template-columns: 1fr;
  }
}

.formulario-ingreso__acciones {
  display: flex;
  justify-content: flex-end;
}
</style>
