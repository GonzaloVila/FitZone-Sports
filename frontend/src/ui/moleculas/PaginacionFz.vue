<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue'
import BotonFz from '../atomos/BotonFz.vue'

const props = withDefaults(
  defineProps<{
    totalPaginas: number
    etiqueta?: string
  }>(),
  {
    etiqueta: 'Paginación',
  },
)

const pagina = defineModel<number>({ required: true })

const anterior = useTemplateRef<InstanceType<typeof BotonFz>>('anterior')
const siguiente = useTemplateRef<InstanceType<typeof BotonFz>>('siguiente')

// Si el botón usado queda deshabilitado (llegó al extremo), el foco pasa al otro para no perderse.
async function cambiar(nueva: number, usado: 'anterior' | 'siguiente') {
  pagina.value = nueva
  await nextTick()
  const botones = { anterior, siguiente }
  const botonUsado = botones[usado].value?.$el as HTMLButtonElement | undefined
  const otro = botones[usado === 'anterior' ? 'siguiente' : 'anterior'].value?.$el as HTMLElement | undefined
  if (botonUsado?.disabled) otro?.focus()
}
</script>

<template>
  <nav class="paginacion" :aria-label="etiqueta">
    <BotonFz
      ref="anterior"
      variante="secundario"
      tamano="sm"
      :disabled="pagina <= 1"
      @click="cambiar(pagina - 1, 'anterior')"
    >
      Anterior
    </BotonFz>
    <span class="paginacion__estado">Página {{ pagina }} de {{ props.totalPaginas }}</span>
    <BotonFz
      ref="siguiente"
      variante="secundario"
      tamano="sm"
      :disabled="pagina >= props.totalPaginas"
      @click="cambiar(pagina + 1, 'siguiente')"
    >
      Siguiente
    </BotonFz>
  </nav>
</template>

<style scoped>
.paginacion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--fz-paginacion-separacion);
}

.paginacion__estado {
  font-size: var(--fz-paginacion-texto);
  color: var(--fz-paginacion-color);
}
</style>
