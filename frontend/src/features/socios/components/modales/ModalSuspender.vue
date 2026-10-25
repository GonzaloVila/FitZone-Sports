<script setup lang="ts">
import { computed } from 'vue'
import { AvisoFz, BotonFz, ModalFz } from '@/ui'
import { periodoTerminado } from '../../presentacion'
import type { Membresia } from '../../services/servicioSocios'
import type { SocioResumen } from '../../tipos'

const props = defineProps<{
  // 'suspender' pasa la membresía a SUSPENDIDA; 'reactivar' la vuelve a ACTIVA.
  modo: 'suspender' | 'reactivar'
  socio: SocioResumen
  membresia: Membresia | null
  ejecutando: boolean
  error: string | null
}>()

const abierto = defineModel<boolean>('abierto', { required: true })
defineEmits<{ confirmar: [] }>()

const suspende = computed(() => props.modo === 'suspender')
// Reactivar una membresía cuyo período ya terminó la deja activa pero sin vigencia hasta que se renueve.
const sinVigencia = computed(() => !suspende.value && props.membresia !== null && periodoTerminado(props.membresia.fechaFin))
</script>

<template>
  <ModalFz
    v-model="abierto"
    :titulo="suspende ? 'Suspender membresía' : 'Reactivar membresía'"
    :icono="suspende ? 'pausa' : 'reproducir'"
    :tono="suspende ? 'advertencia' : 'primario'"
    :ocupado="ejecutando"
  >
    <template v-if="suspende">
      <p class="texto">
        Mientras la membresía esté suspendida, <strong>{{ socio.nombre }}</strong> no podrá ingresar al gimnasio, reservar clases ni anotarse
        en listas de espera. Podrá seguir reservando canchas, pero sin el descuento de socio. Podés reactivarla cuando quieras.
      </p>
    </template>
    <template v-else>
      <p class="texto">
        La membresía de <strong>{{ socio.nombre }}</strong> volverá a estar activa.
      </p>
      <AvisoFz v-if="sinVigencia" variante="advertencia">
        El período ya terminó: seguirá sin poder ingresar hasta que se renueve.
      </AvisoFz>
    </template>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <template #acciones="{ cerrar }">
      <BotonFz variante="secundario" :disabled="ejecutando" @click="cerrar">Cancelar</BotonFz>
      <BotonFz :variante="suspende ? 'advertencia' : 'primario'" :cargando="ejecutando" @click="$emit('confirmar')">
        {{ suspende ? 'Suspender' : 'Reactivar' }}
      </BotonFz>
    </template>
  </ModalFz>
</template>

<style scoped>
.texto {
  margin: 0;
}
</style>
