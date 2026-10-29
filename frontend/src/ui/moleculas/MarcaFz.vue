<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  nombre: string
  descripcion?: string
  // Letra del cuadradito. Por defecto, la primera del nombre.
  inicial?: string
  // Ruta a imagen de logo opcional. Si se define, se muestra la imagen en lugar de la inicial.
  logoUrl?: string
}>()

const letra = computed(() => (props.inicial ?? props.nombre).charAt(0).toUpperCase())
</script>

<template>
  <div class="marca">
    <span v-if="logoUrl" class="marca__logo-custom" aria-hidden="true">
      <img :src="logoUrl" alt="" class="marca__logo-custom-img" />
    </span>
    <span v-else class="marca__logo" aria-hidden="true">{{ letra }}</span>
    <span class="marca__nombre">{{ nombre }}</span>
    <!-- Alineada con el nombre, no con el cuadradito; si no entra, se trunca (el title tiene el texto completo). -->
    <span v-if="descripcion" class="marca__descripcion" :title="descripcion">{{ descripcion }}</span>
  </div>
</template>

<style scoped>
.marca {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: var(--fz-marca-separacion);
  min-width: 0;
}

.marca__logo {
  display: grid;
  place-items: center;
  width: var(--fz-marca-logo-tamano);
  height: var(--fz-marca-logo-tamano);
  border-radius: var(--fz-marca-logo-radio);
  background: var(--fz-marca-logo-fondo);
  color: var(--fz-marca-logo-texto);
  font-size: var(--fz-marca-logo-texto-tamano);
  font-weight: var(--fz-marca-logo-peso);
  line-height: 1;
}

.marca__logo-custom {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1.75rem;
  width: auto;
  line-height: 1;
}

.marca__logo-custom-img {
  height: 100%;
  width: auto;
  max-width: 2.75rem;
  object-fit: contain;
  display: block;
}

.marca__nombre {
  font-size: var(--fz-marca-nombre-texto);
  font-weight: var(--fz-marca-nombre-peso);
  color: var(--fz-marca-nombre-color);
}

.marca__descripcion {
  grid-column: 2;
  overflow: hidden;
  font-size: var(--fz-marca-descripcion-texto);
  font-weight: var(--fz-marca-descripcion-peso);
  color: var(--fz-marca-descripcion-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
