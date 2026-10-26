<script setup lang="ts">
import { computed } from 'vue'
import { AvisoFz, InsigniaFz } from '@/ui'
import type { ResultadoIngresoInfo } from '../composables/useRegistroIngreso'

const props = defineProps<{
  resultado: ResultadoIngresoInfo | null
}>()

const varianteAviso = computed(() => {
  if (!props.resultado) return 'advertencia'
  switch (props.resultado.tipo) {
    case 'exito':
      return 'exito'
    case 'aforo_lleno':
      return 'advertencia'
    case 'membresia_inactiva':
    case 'acceso_duplicado':
    case 'error_validacion':
    case 'error_general':
    default:
      return 'peligro'
  }
})

const icono = computed(() => {
  if (!props.resultado) return ''
  switch (props.resultado.tipo) {
    case 'exito':
      return '✓'
    case 'membresia_inactiva':
      return '⛔'
    case 'acceso_duplicado':
      return '⚠️'
    case 'aforo_lleno':
      return '🚫'
    default:
      return '✕'
  }
})

const tituloEstado = computed(() => {
  if (!props.resultado) return ''
  switch (props.resultado.tipo) {
    case 'exito':
      return 'ACCESO PERMITIDO'
    case 'membresia_inactiva':
      return 'RECHAZADO: MEMBRESÍA INACTIVA'
    case 'acceso_duplicado':
      return 'RECHAZADO: ACCESO DUPLICADO'
    case 'aforo_lleno':
      return 'RECHAZADO: AFORO COMPLETO'
    case 'error_validacion':
      return 'DATOS INVÁLIDOS'
    default:
      return 'ERROR EN EL INGRESO'
  }
})
</script>

<template>
  <div v-if="resultado" class="resultado-ingreso">
    <AvisoFz :variante="varianteAviso" class="resultado-ingreso__caja">
      <div class="resultado-ingreso__cabecera">
        <span class="resultado-ingreso__icono" aria-hidden="true">{{ icono }}</span>
        <div class="resultado-ingreso__titulos">
          <strong class="resultado-ingreso__titulo">{{ tituloEstado }}</strong>
          <p class="resultado-ingreso__mensaje">{{ resultado.mensaje }}</p>
        </div>
      </div>

      <div v-if="resultado.detalle" class="resultado-ingreso__detalle">
        {{ resultado.detalle }}
      </div>

      <div v-if="resultado.ingreso" class="resultado-ingreso__socio">
        <div class="resultado-ingreso__fila">
          <span class="resultado-ingreso__etiqueta">Socio:</span>
          <strong>{{ resultado.ingreso.nombre }}</strong>
        </div>
        <div class="resultado-ingreso__fila">
          <span class="resultado-ingreso__etiqueta">DNI:</span>
          <span>{{ resultado.ingreso.dni }}</span>
        </div>
        <div class="resultado-ingreso__fila">
          <span class="resultado-ingreso__etiqueta">Hora de acceso:</span>
          <span>{{ new Date(resultado.ingreso.fechaHoraIngreso).toLocaleTimeString() }}</span>
        </div>
        <div v-if="resultado.ingreso.validadoOffline" class="resultado-ingreso__fila">
          <InsigniaFz variante="neutra">Registrado Offline</InsigniaFz>
        </div>
      </div>
    </AvisoFz>
  </div>
</template>

<style scoped>
.resultado-ingreso {
  width: 100%;
}

.resultado-ingreso__caja {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.resultado-ingreso__cabecera {
  display: flex;
  align-items: flex-start;
  gap: var(--fz-espaciado-compacto);
}

.resultado-ingreso__icono {
  font-size: 1.5rem;
  line-height: 1;
}

.resultado-ingreso__titulos {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-minimo);
}

.resultado-ingreso__titulo {
  font-size: var(--fz-texto-cuerpo);
  font-weight: var(--fz-peso-enfasis);
}

.resultado-ingreso__mensaje {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
}

.resultado-ingreso__detalle {
  font-size: var(--fz-texto-pequeno);
  opacity: 0.9;
  border-top: 1px dashed var(--fz-color-borde);
  padding-top: var(--fz-espaciado-compacto);
}

.resultado-ingreso__socio {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-minimo);
  background: var(--fz-color-fondo);
  padding: var(--fz-espaciado-compacto);
  border-radius: var(--fz-radio-control);
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto);
  border: 1px solid var(--fz-color-borde);
}

.resultado-ingreso__fila {
  display: flex;
  gap: var(--fz-espaciado-compacto);
  align-items: center;
}

.resultado-ingreso__etiqueta {
  color: var(--fz-color-texto-suave);
}
</style>
