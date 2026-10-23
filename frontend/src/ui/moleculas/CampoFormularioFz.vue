<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue'
import CampoTextoFz from '../atomos/CampoTextoFz.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  etiqueta: string
  ayuda?: string
  error?: string
  id?: string
}>()

const modelo = defineModel<string>()
const attrs = useAttrs()

const idGenerado = useId()
const idCampo = computed(() => props.id ?? idGenerado)
const idAyuda = computed(() => `${idCampo.value}-ayuda`)
const idError = computed(() => `${idCampo.value}-error`)

// Ayuda y error describen al campo; se conserva el aria-describedby que llegue desde afuera.
const describedby = computed(() => {
  const ids = [
    typeof attrs['aria-describedby'] === 'string' ? attrs['aria-describedby'] : undefined,
    props.ayuda ? idAyuda.value : undefined,
    props.error ? idError.value : undefined,
  ].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
})
</script>

<template>
  <div class="campo-formulario">
    <label :for="idCampo" class="campo-formulario__etiqueta">{{ etiqueta }}</label>
    <CampoTextoFz
      v-bind="attrs"
      :id="idCampo"
      v-model="modelo"
      :invalido="Boolean(error)"
      :aria-describedby="describedby"
    />
    <p v-if="ayuda" :id="idAyuda" class="campo-formulario__ayuda">{{ ayuda }}</p>
    <p v-if="error" :id="idError" class="campo-formulario__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.campo-formulario {
  display: flex;
  flex-direction: column;
  gap: var(--fz-campo-formulario-separacion);
}

.campo-formulario__etiqueta {
  font-size: var(--fz-campo-formulario-etiqueta-texto);
  font-weight: var(--fz-campo-formulario-etiqueta-peso);
  color: var(--fz-campo-formulario-etiqueta-color);
}

.campo-formulario__ayuda,
.campo-formulario__error {
  margin: 0;
}

.campo-formulario__ayuda {
  font-size: var(--fz-campo-formulario-ayuda-texto);
  color: var(--fz-campo-formulario-ayuda-color);
}

.campo-formulario__error {
  font-size: var(--fz-campo-formulario-error-texto);
  color: var(--fz-campo-formulario-error-color);
}
</style>
