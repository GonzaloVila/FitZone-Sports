<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import { AvisoFz, BotonFz, ModalFz, SelectFz } from '@/ui'

const props = defineProps<{
  sedes: Sede[]
  sedeActualId: number
  ejecutando: boolean
  error: string | null
}>()

const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ confirmar: [sedeId: number] }>()

const idSede = useId()
const sedeElegida = ref(String(props.sedeActualId))

// Al abrir, queda elegida la sede actual.
watch(abierto, (valor) => {
  if (valor) sedeElegida.value = String(props.sedeActualId)
})

const sedeNueva = computed(() => Number(sedeElegida.value))
const cambia = computed(() => Number.isInteger(sedeNueva.value) && sedeNueva.value !== props.sedeActualId)

function confirmar() {
  if (cambia.value) emit('confirmar', sedeNueva.value)
}
</script>

<template>
  <ModalFz v-model="abierto" titulo="Cambiar la sede de origen" icono="lugar" tono="primario" ancho="angosto" :ocupado="ejecutando">
    <div class="campo">
      <label :for="idSede" class="campo__etiqueta">Sede de origen</label>
      <SelectFz :id="idSede" v-model="sedeElegida" :disabled="ejecutando">
        <option v-for="sede in sedes" :key="sede.id" :value="String(sede.id)">{{ sede.nombre }}</option>
      </SelectFz>
    </div>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <template #acciones="{ cerrar }">
      <BotonFz variante="secundario" :disabled="ejecutando" @click="cerrar">Cancelar</BotonFz>
      <BotonFz :cargando="ejecutando" :disabled="!cambia" @click="confirmar">Cambiar sede</BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.campo {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.campo__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: var(--fz-peso-enfasis);
}
</style>
