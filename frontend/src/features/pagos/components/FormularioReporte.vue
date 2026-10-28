<script setup lang="ts">
import { AvisoFz, BotonFz, CampoTextoFz, IconoFz } from '@/ui'

defineProps<{ errorFechas: string | null; descargando: boolean; error: string | null }>()
const emit = defineEmits<{ descargar: [] }>()

const desde = defineModel<string>('desde', { required: true })
const hasta = defineModel<string>('hasta', { required: true })
</script>

<template>
  <form class="formulario-reporte" @submit.prevent="emit('descargar')">
    <!-- Una sola fila: las dos fechas a la izquierda y la descarga pegada al borde derecho; en ancho chico se apila. -->
    <div class="formulario-reporte__fila">
      <!-- Las fechas mantienen su etiqueta visible: un campo de fecha vacío no dice por sí solo para qué sirve. -->
      <div class="formulario-reporte__fecha">
        <label for="reporte-desde" class="formulario-reporte__etiqueta">Desde</label>
        <CampoTextoFz id="reporte-desde" v-model="desde" tipo="date" name="desde" />
      </div>
      <div class="formulario-reporte__fecha">
        <label for="reporte-hasta" class="formulario-reporte__etiqueta">Hasta</label>
        <CampoTextoFz id="reporte-hasta" v-model="hasta" tipo="date" name="hasta" />
      </div>
      <BotonFz class="formulario-reporte__descargar" tipo="submit" :cargando="descargando" :disabled="descargando || Boolean(errorFechas)">
        <IconoFz v-if="!descargando" nombre="descargar" tamano="sm" />
        Descargar PDF
      </BotonFz>
    </div>
    <p class="formulario-reporte__nota">
      El rango incluye desde y hasta. Si dejás las dos fechas vacías, el reporte incluye todo el histórico.
    </p>
    <AvisoFz v-if="errorFechas" variante="advertencia">{{ errorFechas }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
  </form>
</template>

<style scoped>
.formulario-reporte {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.formulario-reporte__fila {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.formulario-reporte__fecha {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
  width: max-content;
  max-width: 100%;
}

.formulario-reporte__etiqueta {
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

/* La descarga queda pegada al borde derecho de la misma fila. */
.formulario-reporte__descargar {
  margin-inline-start: auto;
}

.formulario-reporte__nota {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}
</style>
