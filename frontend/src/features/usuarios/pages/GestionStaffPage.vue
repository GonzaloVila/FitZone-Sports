<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, BotonFz, CampoTextoFz, EncabezadoPaginaFz, IconoFz, InsigniaFz, PaginacionFz } from '@/ui'
import TablaStaff from '../components/TablaStaff.vue'
import ModalAltaStaff from '../components/modales/ModalAltaStaff.vue'
import { useListaStaff } from '../composables/useListaStaff'
import { ETIQUETA_RECEPCION, ETIQUETA_RECEPCION_PLURAL } from '../presentacion'

const {
  nombre,
  pagina,
  porPagina,
  items,
  total,
  totalPaginas,
  cargando,
  error,
  hayFiltrosActivos,
  recargar,
} = useListaStaff()
const { sedes, error: errorSedes, nombreDeSede } = useSedes()

const hayFilas = computed(() => items.value.length > 0)
const cargandoSinFilas = computed(() => cargando.value && !hayFilas.value)
const vacio = computed(() => !cargando.value && !hayFilas.value && !error.value)

const rangoInicio = computed(() => (total.value === 0 ? 0 : (pagina.value - 1) * porPagina + 1))
const rangoFin = computed(() => Math.min(total.value, pagina.value * porPagina))
const textoRango = computed(() => {
  if (cargandoSinFilas.value || error.value) return ''
  if (total.value === 0) return `0 ${ETIQUETA_RECEPCION_PLURAL.toLowerCase()}`
  const sustantivo = total.value === 1 ? ETIQUETA_RECEPCION.toLowerCase() : ETIQUETA_RECEPCION_PLURAL.toLowerCase()
  return `Mostrando ${rangoInicio.value} a ${rangoFin.value} de ${total.value} ${sustantivo}`
})

const altaAbierta = ref(false)
</script>

<template>
  <section class="staff">
    <EncabezadoPaginaFz
      titulo="Staff"
      subtitulo="Vista del gerente central: un recepcionista por sede."
    >
      <template #insignia>
        <InsigniaFz>{{ total }} {{ total === 1 ? ETIQUETA_RECEPCION.toLowerCase() : ETIQUETA_RECEPCION_PLURAL.toLowerCase() }}</InsigniaFz>
      </template>
      <template #acciones>
        <BotonFz @click="altaAbierta = true">
          <IconoFz nombre="mas" tamano="sm" />
          Nuevo recepcionista
        </BotonFz>
      </template>
    </EncabezadoPaginaFz>

    <div class="staff__barra">
      <CampoTextoFz
        v-model="nombre"
        class="staff__buscar"
        tipo="search"
        tamano="sm"
        icono="buscar"
        placeholder="Buscar por nombre"
        aria-label="Buscar recepcionistas por nombre"
      />
    </div>

    <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <TablaStaff
      v-if="hayFilas"
      :filas="items"
      :nombre-sede="nombreDeSede"
      :ocupada="cargando"
    />

    <p v-else-if="cargandoSinFilas" class="staff__estado" role="status">Cargando recepcionistas.</p>

    <p v-else-if="vacio" class="staff__estado staff__vacio">
      {{
        hayFiltrosActivos
          ? 'No se encontraron recepcionistas con ese nombre.'
          : 'Todavía no hay recepcionistas.'
      }}
    </p>

    <ModalAltaStaff v-model:abierto="altaAbierta" :sedes="sedes" @creado="recargar" />

    <footer class="staff__pie">
      <p class="staff__rango" role="status" aria-live="polite" aria-atomic="true">{{ textoRango }}</p>
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
.staff {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.staff__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--fz-espaciado-base);
}

.staff__buscar {
  width: min(18rem, 100%);
}

.staff__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.staff__vacio {
  padding: var(--fz-espaciado-amplio) 0;
}

.staff__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.staff__rango {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
