<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, BotonFz, EncabezadoPaginaFz, IconoFz, PaginacionFz } from '@/ui'
import FiltrosPersonal from '../components/FiltrosPersonal.vue'
import TablaPersonal from '../components/TablaPersonal.vue'
import ModalAltaPersonal from '../components/modales/ModalAltaPersonal.vue'
import { useListaPersonal } from '../composables/useListaPersonal'
import { ETIQUETA_RECEPCION, ETIQUETA_RECEPCION_PLURAL } from '../presentacion'

const {
  sede,
  nombre,
  pagina,
  porPagina,
  items,
  total,
  totalPaginas,
  cargando,
  error,
  hayFiltrosActivos,
  limpiarFiltros,
  recargar,
} = useListaPersonal()
const { sedes, cargando: cargandoSedes, error: errorSedes, nombreDeSede } = useSedes()

const hayFilas = computed(() => items.value.length > 0)
const cargandoSinFilas = computed(() => cargando.value && !hayFilas.value)
const vacio = computed(() => !cargando.value && !hayFilas.value && !error.value)

const rangoInicio = computed(() => (total.value === 0 ? 0 : (pagina.value - 1) * porPagina + 1))
const rangoFin = computed(() => Math.min(total.value, pagina.value * porPagina))

// La región del pie siempre está en el DOM (los lectores de pantalla solo anuncian cambios de una región existente);
// mientras no hay un resultado que informar, queda vacía.
const textoRango = computed(() => {
  if (cargandoSinFilas.value || error.value) return ''
  if (total.value === 0) return `0 ${ETIQUETA_RECEPCION_PLURAL.toLowerCase()}`
  const sustantivo = total.value === 1 ? ETIQUETA_RECEPCION.toLowerCase() : ETIQUETA_RECEPCION_PLURAL.toLowerCase()
  return `Mostrando ${rangoInicio.value} a ${rangoFin.value} de ${total.value} ${sustantivo}`
})

const altaAbierta = ref(false)
</script>

<template>
  <section class="personal">
    <EncabezadoPaginaFz titulo="Personal" subtitulo="Un recepcionista por sede.">
      <template #acciones>
        <BotonFz @click="altaAbierta = true">
          <IconoFz nombre="mas" tamano="sm" />
          Nuevo recepcionista
        </BotonFz>
      </template>
    </EncabezadoPaginaFz>

    <FiltrosPersonal
      v-model:sede="sede"
      v-model:nombre="nombre"
      :sedes="sedes"
      :cargando-sedes="cargandoSedes"
      :hay-filtros-activos="hayFiltrosActivos"
      @limpiar="limpiarFiltros"
    />

    <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <TablaPersonal v-if="hayFilas" :filas="items" :nombre-sede="nombreDeSede" :ocupada="cargando" />

    <p v-else-if="cargandoSinFilas" class="personal__estado" role="status">Cargando recepcionistas…</p>

    <p v-else-if="vacio" class="personal__estado personal__vacio">
      {{
        hayFiltrosActivos
          ? 'No se encontraron recepcionistas con los filtros elegidos. Probá con otra sede o con otro nombre.'
          : 'Todavía no hay recepcionistas.'
      }}
    </p>

    <ModalAltaPersonal v-model:abierto="altaAbierta" :sedes="sedes" @creado="recargar" />

    <footer class="personal__pie">
      <p class="personal__rango" role="status" aria-live="polite" aria-atomic="true">{{ textoRango }}</p>
      <PaginacionFz
        v-if="totalPaginas > 1"
        v-model="pagina"
        :total-paginas="totalPaginas"
        etiqueta="Paginación de recepcionistas"
      />
    </footer>
  </section>
</template>

<style scoped>
.personal {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.personal__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.personal__vacio {
  padding: var(--fz-espaciado-amplio) 0;
}

.personal__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.personal__rango {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
