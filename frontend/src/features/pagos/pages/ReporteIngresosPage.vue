<script setup lang="ts">
import { EncabezadoPaginaFz } from '@/ui'
import FormularioReporte from '../components/FormularioReporte.vue'
import { useReporteIngresos } from '../composables/useReporteIngresos'

const { desde, hasta, errorFechas, descargando, error, descargarReporte } = useReporteIngresos()
</script>

<template>
  <section class="reporte">
    <EncabezadoPaginaFz
      titulo="Reporte de ingresos"
      subtitulo="Consolidado en PDF de los pagos aprobados, agrupado por día, sede y concepto."
    />

    <FormularioReporte
      v-model:desde="desde"
      v-model:hasta="hasta"
      :error-fechas="errorFechas"
      :descargando="descargando"
      :error="error"
      @descargar="descargarReporte"
    />
  </section>
</template>

<style scoped>
.reporte {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}
</style>
