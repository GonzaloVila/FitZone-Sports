<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, BotonFz, EncabezadoPaginaFz, IconoFz } from '@/ui'
import FiltrosHistorial from '../components/FiltrosHistorial.vue'
import TablaHistorial from '../components/TablaHistorial.vue'
import { useHistorialAccesos } from '../composables/useHistorialAccesos'

const { rol, sedeId: sedeUsuario } = useUsuarioSesion()
const esGerente = computed(() => rol.value === 'GERENTE')

const { sedes, nombreDeSede } = useSedes()

const {
  filtros,
  pagina,
  porPagina,
  items,
  total,
  totalPaginas,
  cargando,
  error,
} = useHistorialAccesos(esGerente.value ? null : sedeUsuario.value)

// "Limpiar" deja los filtros vacíos; la sede del RECEPCION no es un filtro suyo y se conserva.
function limpiarFiltros() {
  filtros.fecha = ''
  filtros.nombre = ''
  filtros.socioId = ''
  if (esGerente.value) filtros.sedeId = ''
}
</script>

<template>
  <section class="historial-accesos">
    <EncabezadoPaginaFz
      titulo="Historial de accesos"
      subtitulo="Ingresos y egresos registrados en las sedes."
      :volver="{ texto: 'Volver al aforo', a: { name: 'acceso-aforo' } }"
    >
      <template #acciones>
        <RouterLink v-slot="{ href, navigate }" :to="{ name: 'acceso-ingreso' }" custom>
          <BotonFz como="a" :href="href" @click="navigate">
            <IconoFz nombre="mas" tamano="sm" />
            Registrar ingreso
          </BotonFz>
        </RouterLink>
      </template>
    </EncabezadoPaginaFz>

    <FiltrosHistorial v-model:filtros="filtros" :sedes="sedes" :es-gerente="esGerente" @limpiar="limpiarFiltros" />

    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <TablaHistorial
      v-model:pagina="pagina"
      :items="items"
      :total="total"
      :total-paginas="totalPaginas"
      :por-pagina="porPagina"
      :cargando="cargando"
      :nombre-de-sede="nombreDeSede"
    />
  </section>
</template>

<style scoped>
.historial-accesos {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}
</style>
