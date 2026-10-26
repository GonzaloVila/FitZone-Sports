<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, BotonFz, EncabezadoPaginaFz, IconoFz } from '@/ui'
import FiltrosHistorial from '../components/FiltrosHistorial.vue'
import ModalRegistrarIngreso from '../components/modales/ModalRegistrarIngreso.vue'
import TablaHistorial from '../components/TablaHistorial.vue'
import { useHistorialAccesos } from '../composables/useHistorialAccesos'
import { useSedeActiva } from '../composables/useSedeActiva'

const { rol, sedeId: sedeUsuario } = useUsuarioSesion()
const esGerente = computed(() => rol.value === 'GERENTE')

const { sedes, cargando: cargandoSedes, nombreDeSede } = useSedes()

const sedeActiva = useSedeActiva(sedes, () => (esGerente.value ? null : sedeUsuario.value))

const {
  filtros,
  pagina,
  porPagina,
  items,
  total,
  totalPaginas,
  cargando,
  error,
  recargar,
} = useHistorialAccesos(esGerente.value ? null : sedeUsuario.value)

// "Limpiar" deja los filtros vacíos; la sede del RECEPCION no es un filtro suyo y se conserva.
function limpiarFiltros() {
  filtros.fecha = ''
  filtros.nombre = ''
  filtros.socioId = ''
  if (esGerente.value) filtros.sedeId = ''
}

// El modal de ingreso abre con la sede que se esté filtrando; si no hay una elegida, con la sede activa.
const ingresoAbierto = ref(false)
const sedeDelIngreso = computed(() => (typeof filtros.sedeId === 'number' && filtros.sedeId > 0 ? filtros.sedeId : sedeActiva.value))
</script>

<template>
  <section class="historial-accesos">
    <EncabezadoPaginaFz
      titulo="Historial de accesos"
      subtitulo="Ingresos y egresos registrados en las sedes."
      :volver="{ texto: 'Volver al aforo', a: { name: 'acceso-aforo' } }"
    >
      <template #acciones>
        <BotonFz @click="ingresoAbierto = true">
          <IconoFz nombre="mas" tamano="sm" />
          Registrar ingreso
        </BotonFz>
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

    <ModalRegistrarIngreso
      v-model:abierto="ingresoAbierto"
      :sedes="sedes"
      :sede-inicial="sedeDelIngreso"
      :con-selector-sede="esGerente"
      :cargando-sedes="cargandoSedes"
      @registrado="recargar"
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
