<script setup lang="ts">
import { ref, useAttrs } from 'vue'
import IconoFz from '../atomos/IconoFz.vue'
import CampoFormularioFz from './CampoFormularioFz.vue'

// `name`, `autocomplete` y el resto de atributos pasan al <input> a través de CampoFormularioFz.
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    etiqueta: string
    ayuda?: string
    error?: string
    id?: string
    // Nombre accesible del botón. Es fijo (no cambia con el estado): el estado lo da aria-pressed.
    etiquetaBoton?: string
  }>(),
  {
    etiquetaBoton: 'Mostrar contraseña',
  },
)

const modelo = defineModel<string>()
const attrs = useAttrs()

const visible = ref(false)
</script>

<template>
  <div class="campo-contrasenia">
    <CampoFormularioFz
      v-bind="attrs"
      v-model="modelo"
      :etiqueta="etiqueta"
      :ayuda="ayuda"
      :error="error"
      :id="id"
      :tipo="visible ? 'text' : 'password'"
    >
      <template #sufijo>
        <button
          type="button"
          class="campo-contrasenia__boton"
          :aria-label="etiquetaBoton"
          :aria-pressed="visible"
          @click="visible = !visible"
        >
          <IconoFz :nombre="visible ? 'ojo-tachado' : 'ojo'" tamano="sm" />
        </button>
      </template>
    </CampoFormularioFz>
  </div>
</template>

<style scoped>
/* Deja lugar al botón: su ancho más el margen de cada lado. */
.campo-contrasenia :deep(input) {
  padding-right: calc(var(--fz-campo-contrasenia-boton-tamano) + 2 * var(--fz-campo-formulario-sufijo-margen));
}

.campo-contrasenia__boton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--fz-campo-contrasenia-boton-tamano);
  height: var(--fz-campo-contrasenia-boton-tamano);
  padding: 0;
  border: none;
  border-radius: var(--fz-campo-contrasenia-boton-radio);
  background: transparent;
  color: var(--fz-campo-contrasenia-icono-color);
  cursor: pointer;
}

.campo-contrasenia__boton:hover {
  background: var(--fz-campo-contrasenia-boton-fondo-hover);
  color: var(--fz-campo-contrasenia-icono-color-hover);
}

/* Foco visible (WCAG 1.4.11): el anillo queda dentro del botón, que está dentro del campo. */
.campo-contrasenia__boton:focus-visible {
  outline: var(--fz-campo-contrasenia-foco-ancho) solid var(--fz-campo-contrasenia-foco-color);
  outline-offset: calc(-1 * var(--fz-campo-contrasenia-foco-ancho));
}
</style>
