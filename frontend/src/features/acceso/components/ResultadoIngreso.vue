<script setup lang="ts">
import { computed } from 'vue'
import { AvisoFz, InsigniaFz } from '@/ui'
import type { ResultadoIngresoInfo } from '../composables/useRegistroIngreso'

const props = defineProps<{
  resultado: ResultadoIngresoInfo | null
}>()

// Ingreso permitido (verde), denegado por aforo (ámbar) o por otro motivo (rojo). AvisoFz anuncia el resultado solo.
const variante = computed(() => {
  switch (props.resultado?.tipo) {
    case 'exito':
      return 'exito'
    case 'aforo_lleno':
      return 'advertencia'
    default:
      return 'peligro'
  }
})

const titulo = computed(() => {
  switch (props.resultado?.tipo) {
    case 'exito':
      return 'Ingreso permitido'
    case 'membresia_inactiva':
    case 'acceso_duplicado':
    case 'aforo_lleno':
      return 'Ingreso denegado'
    default:
      return 'No se pudo registrar el ingreso'
  }
})

function hora(iso: string): string {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? iso : fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <AvisoFz v-if="resultado" :variante="variante">
    <div class="resultado">
      <p class="resultado__titulo">{{ titulo }}</p>
      <p class="resultado__linea">{{ resultado.mensaje }}</p>
      <p v-if="resultado.detalle" class="resultado__linea">{{ resultado.detalle }}</p>
      <p v-if="resultado.ingreso" class="resultado__linea">
        DNI {{ resultado.ingreso.dni }} · {{ hora(resultado.ingreso.fechaHoraIngreso) }}
        <InsigniaFz v-if="resultado.ingreso.validadoOffline">Registrado sin conexión</InsigniaFz>
      </p>
    </div>
  </AvisoFz>
</template>

<style scoped>
.resultado {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-minimo);
}

.resultado__titulo {
  margin: 0;
  font-weight: var(--fz-peso-enfasis);
}

.resultado__linea {
  margin: 0;
}
</style>
