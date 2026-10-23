<script setup lang="ts">
import { toDataURL } from 'qrcode'
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    // Texto a codificar.
    texto: string
    // Descripción para lectores de pantalla (el contenido del QR no se lee).
    alt: string
    // Lado de la imagen, en píxeles.
    tamano?: number
  }>(),
  {
    tamano: 224,
  },
)

const imagen = ref<string | null>(null)
const fallo = ref(false)

// Descarte de respuestas viejas si el texto cambia mientras se genera.
let ultimaGeneracion = 0

watch(
  () => [props.texto, props.tamano] as const,
  async ([texto, tamano]) => {
    const generacion = ++ultimaGeneracion
    fallo.value = false
    if (!texto) {
      imagen.value = null
      return
    }
    try {
      const url = await toDataURL(texto, { errorCorrectionLevel: 'M', margin: 2, width: tamano })
      if (generacion === ultimaGeneracion) imagen.value = url
    } catch {
      if (generacion === ultimaGeneracion) {
        imagen.value = null
        fallo.value = true
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="qr">
    <img v-if="imagen" class="qr__imagen" :src="imagen" :alt="alt" :width="tamano" :height="tamano" />
    <p v-else-if="fallo" class="qr__error" role="alert">No se pudo generar el código QR.</p>
  </div>
</template>

<style scoped>
.qr {
  display: inline-block;
  padding: var(--fz-qr-relleno);
  border: var(--fz-qr-borde-ancho) solid var(--fz-qr-borde);
  border-radius: var(--fz-qr-radio);
  background: var(--fz-qr-fondo);
  line-height: 0;
}

.qr__imagen {
  display: block;
  max-width: 100%;
  height: auto;
  image-rendering: pixelated;
}

.qr__error {
  margin: 0;
  font-size: var(--fz-qr-error-texto);
  color: var(--fz-qr-error-color);
  line-height: normal;
}
</style>
