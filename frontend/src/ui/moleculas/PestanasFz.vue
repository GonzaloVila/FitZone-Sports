<script setup lang="ts">
import { nextTick, useId, useTemplateRef } from 'vue'

export interface PestanaFz {
  // Identifica la pestaña: su contenido se pasa por el slot `panel-<id>`.
  id: string
  etiqueta: string
}

const props = defineProps<{
  pestanas: PestanaFz[]
  // Nombre accesible del grupo de pestañas.
  etiqueta: string
}>()

defineSlots<{
  [panel: `panel-${string}`]: () => unknown
}>()

const activa = defineModel<string>({ required: true })

const base = useId()
const lista = useTemplateRef<HTMLElement>('lista')

const idPestana = (id: string) => `${base}-pestana-${id}`
const idPanel = (id: string) => `${base}-panel-${id}`

// Flechas, Inicio y Fin mueven la selección y el foco (activación automática, patrón WAI-ARIA).
async function alTeclear(evento: KeyboardEvent) {
  const indice = props.pestanas.findIndex((pestana) => pestana.id === activa.value)
  const total = props.pestanas.length
  if (indice < 0 || total === 0) return

  let destino: number
  switch (evento.key) {
    case 'ArrowRight':
      destino = (indice + 1) % total
      break
    case 'ArrowLeft':
      destino = (indice - 1 + total) % total
      break
    case 'Home':
      destino = 0
      break
    case 'End':
      destino = total - 1
      break
    default:
      return
  }
  evento.preventDefault()
  const pestana = props.pestanas[destino]
  if (!pestana) return
  activa.value = pestana.id
  await nextTick()
  lista.value?.querySelector<HTMLElement>(`#${CSS.escape(idPestana(pestana.id))}`)?.focus()
}
</script>

<template>
  <div class="pestanas">
    <div ref="lista" class="pestanas__lista" role="tablist" :aria-label="etiqueta" @keydown="alTeclear">
      <button
        v-for="pestana in pestanas"
        :id="idPestana(pestana.id)"
        :key="pestana.id"
        type="button"
        role="tab"
        :class="['pestanas__pestana', { 'pestanas__pestana--activa': pestana.id === activa }]"
        :aria-selected="pestana.id === activa"
        :aria-controls="idPanel(pestana.id)"
        :tabindex="pestana.id === activa ? 0 : -1"
        @click="activa = pestana.id"
      >
        {{ pestana.etiqueta }}
      </button>
    </div>
    <template v-for="pestana in pestanas" :key="pestana.id">
      <div
        v-if="pestana.id === activa"
        :id="idPanel(pestana.id)"
        class="pestanas__panel"
        role="tabpanel"
        :aria-labelledby="idPestana(pestana.id)"
        tabindex="0"
      >
        <slot :name="`panel-${pestana.id}`" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.pestanas {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.pestanas__lista {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fz-espaciado-compacto);
  border-bottom: 1px solid var(--fz-color-borde);
}

.pestanas__pestana {
  margin-bottom: -1px;
  padding: var(--fz-espaciado-compacto) var(--fz-espaciado-base);
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--fz-color-texto-suave);
  font-family: inherit;
  font-size: var(--fz-texto-pequeno);
  font-weight: var(--fz-peso-enfasis);
  cursor: pointer;
}

.pestanas__pestana:hover {
  color: var(--fz-color-texto);
  background: var(--fz-color-hover);
}

.pestanas__pestana--activa {
  border-bottom-color: var(--fz-color-primario);
  color: var(--fz-color-texto);
}

.pestanas__pestana:focus-visible,
.pestanas__panel:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}
</style>
