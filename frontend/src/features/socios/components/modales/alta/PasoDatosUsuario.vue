<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { CampoFormularioFz, SelectFz, SelectorSegmentadoFz, type OpcionSegmentadaFz } from '@/ui'
import type { AltaSocio } from '../../../composables/useAltaSocio'
import BuscadorUsuarios from './BuscadorUsuarios.vue'
import FormularioUsuarioNuevo from './FormularioUsuarioNuevo.vue'

const props = defineProps<{
  alta: AltaSocio
  sedes: Sede[]
}>()

const raiz = useTemplateRef<HTMLElement>('raiz')

const modos: OpcionSegmentadaFz[] = [
  { valor: 'nuevo', etiqueta: 'No tiene cuenta' },
  { valor: 'existente', etiqueta: 'Ya tiene cuenta' },
]

// Al cambiar de modo (lo escrito en cada uno se conserva) el foco pasa al primer campo del modo elegido.
async function cambiarModo(valor: string) {
  if (valor !== 'nuevo' && valor !== 'existente') return
  props.alta.modo = valor
  await nextTick()
  raiz.value?.querySelector<HTMLElement>('[data-primer-campo]')?.focus()
}
</script>

<template>
  <fieldset ref="raiz" class="paso" :disabled="alta.enviando">
    <SelectorSegmentadoFz
      :model-value="alta.modo"
      nombre="modo-usuario"
      leyenda="¿El socio ya tiene cuenta?"
      :opciones="modos"
      @update:model-value="cambiarModo"
    />

    <FormularioUsuarioNuevo v-if="alta.modo === 'nuevo'" :alta="alta" />
    <BuscadorUsuarios v-else :alta="alta" />

    <CampoFormularioFz etiqueta="Sede de origen" etiqueta-chica obligatorio :error="alta.errores.sede">
      <template #default="{ id, describedby, invalido }">
        <SelectFz
          :id="id"
          v-model="alta.sede"
          name="sede"
          aria-required="true"
          :invalido="invalido"
          :aria-describedby="describedby"
        >
          <option value="" disabled>Elegí una sede</option>
          <option v-for="sede in sedes" :key="sede.id" :value="String(sede.id)">{{ sede.nombre }}</option>
        </SelectFz>
      </template>
    </CampoFormularioFz>
  </fieldset>
</template>

<style scoped>
.paso {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
}
</style>
