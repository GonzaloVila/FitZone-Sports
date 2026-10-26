<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue'
import CampoTextoFz from '../atomos/CampoTextoFz.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  etiqueta: string
  ayuda?: string
  error?: string
  id?: string
  // Marca la etiqueta con un asterisco (decorativo) y el campo con aria-required.
  obligatorio?: boolean
  // Etiqueta en el tamaño mínimo (12 px), para formularios densos como los de un modal.
  etiquetaChica?: boolean
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
    <label :for="idCampo" :class="['campo-formulario__etiqueta', { 'campo-formulario__etiqueta--chica': etiquetaChica }]">
      {{ etiqueta }}
      <span v-if="obligatorio" class="campo-formulario__asterisco" aria-hidden="true">*</span>
    </label>
    <!-- Con contenido propio (un select, por ejemplo) el campo de texto no se dibuja: el contenido recibe el id y el aria-describedby. -->
    <slot v-if="$slots.default" :id="idCampo" :describedby="describedby" :invalido="Boolean(error)" />
    <div v-else-if="$slots.sufijo" class="campo-formulario__control">
      <CampoTextoFz
        v-bind="attrs"
        :id="idCampo"
        v-model="modelo"
        :invalido="Boolean(error)"
        :aria-required="obligatorio || undefined"
        :aria-describedby="describedby"
      />
      <div class="campo-formulario__sufijo"><slot name="sufijo" /></div>
    </div>
    <CampoTextoFz
      v-else
      v-bind="attrs"
      :id="idCampo"
      v-model="modelo"
      :invalido="Boolean(error)"
      :aria-required="obligatorio || undefined"
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

.campo-formulario__etiqueta--chica {
  font-size: var(--fz-campo-formulario-etiqueta-texto-chica);
}

.campo-formulario__asterisco {
  color: var(--fz-campo-formulario-obligatorio-color);
}

/* Con slot `sufijo`: el contenido se apoya sobre el borde derecho del campo (el campo reserva su lugar). */
.campo-formulario__control {
  position: relative;
}

.campo-formulario__sufijo {
  position: absolute;
  top: 0;
  right: var(--fz-campo-formulario-sufijo-margen);
  bottom: 0;
  display: flex;
  align-items: center;
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
