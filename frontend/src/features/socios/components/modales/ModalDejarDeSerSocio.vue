<script setup lang="ts">
import { AvisoFz, BotonFz, ModalFz } from '@/ui'
import type { SocioResumen } from '../../tipos'

defineProps<{
  socio: SocioResumen
  ejecutando: boolean
  error: string | null
}>()

const abierto = defineModel<boolean>('abierto', { required: true })
defineEmits<{ confirmar: [] }>()
</script>

<template>
  <ModalFz v-model="abierto" titulo="Dejar de ser socio" icono="quitar-usuario" tono="peligro" ancho="angosto" :ocupado="ejecutando">
    <p class="texto">
      <strong>{{ socio.nombre }}</strong> dejará de ser socio y volverá a ser un usuario externo. Ya no podrá ingresar con su carnet. Se conserva su
      historial de ingresos, reservas y pagos.
    </p>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <template #acciones="{ cerrar }">
      <BotonFz variante="secundario" :disabled="ejecutando" @click="cerrar">Cancelar</BotonFz>
      <BotonFz variante="peligro" :cargando="ejecutando" @click="$emit('confirmar')">Dejar de ser socio</BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.texto {
  margin: 0;
}
</style>
