<script setup lang="ts">
import FormularioReporte from '../components/FormularioReporte.vue'
import { useReporteIngresos } from '../composables/useReporteIngresos'

const { desde, hasta, errorFechas, descargando, error, descargarReporte } = useReporteIngresos()
</script>

<template>
  <section class="reporte">
    <header class="reporte__encabezado">
      <h1 class="reporte__titulo">Reporte de ingresos</h1>
      <p class="reporte__subtitulo">Consolidado de pagos aprobados por período. Solo GERENTE.</p>
    </header>

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
  gap: 1.5rem;
  max-width: 48rem;
  margin: 0 auto;
  width: 100%;
}

.reporte__encabezado {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.reporte__titulo {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fz-color-texto);
}

.reporte__subtitulo {
  margin: 0;
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}
</style>
