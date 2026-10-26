<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, BotonFz } from '@/ui'
import FiltrosHistorial from '../components/FiltrosHistorial.vue'
import TablaHistorial from '../components/TablaHistorial.vue'
import { useHistorialAccesos } from '../composables/useHistorialAccesos'

const { rol, sedeId: sedeUsuario } = useUsuarioSesion()
const esGerente = computed(() => rol.value === 'GERENTE')

const { sedes, nombreDeSede } = useSedes()

const {
  filtros,
  pagina,
  items,
  total,
  totalPaginas,
  cargando,
  error,
} = useHistorialAccesos(esGerente.value ? null : sedeUsuario.value)
</script>

<template>
  <div class="historial-accesos-page">
    <header class="historial-accesos-page__encabezado">
      <div>
        <h1 class="historial-accesos-page__titulo">Historial de Accesos</h1>
        <p class="historial-accesos-page__subtitulo">
          Consultá los registros históricos de ingresos y egresos de los socios.
        </p>
      </div>

      <div class="historial-accesos-page__acciones">
        <RouterLink to="/acceso/aforo">
          <BotonFz variante="secundario">Aforo y Ocupación</BotonFz>
        </RouterLink>
        <RouterLink to="/acceso/ingreso">
          <BotonFz variante="primario">Registrar Ingreso</BotonFz>
        </RouterLink>
      </div>
    </header>

    <div v-if="error" class="historial-accesos-page__alerta">
      <AvisoFz variante="peligro">{{ error }}</AvisoFz>
    </div>

    <!-- Filtros -->
    <FiltrosHistorial
      v-model:filtros="filtros"
      :sedes="sedes"
      :es-gerente="esGerente"
    />

    <!-- Tabla -->
    <TablaHistorial
      v-model:pagina="pagina"
      :items="items"
      :total="total"
      :total-paginas="totalPaginas"
      :cargando="cargando"
      :nombre-de-sede="nombreDeSede"
    />
  </div>
</template>

<style scoped>
.historial-accesos-page {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-amplio);
  max-width: 64rem;
  margin: 0 auto;
  width: 100%;
}

.historial-accesos-page__encabezado {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--fz-espaciado-base);
  flex-wrap: wrap;
}

.historial-accesos-page__titulo {
  margin: 0;
  font-size: var(--fz-texto-titulo);
  font-weight: var(--fz-peso-enfasis);
  color: var(--fz-color-texto);
}

.historial-accesos-page__subtitulo {
  margin: var(--fz-espaciado-minimo) 0 0;
  color: var(--fz-color-texto-suave);
}

.historial-accesos-page__acciones {
  display: flex;
  gap: var(--fz-espaciado-medio);
  align-items: center;
}

.historial-accesos-page__alerta {
  width: 100%;
}
</style>
