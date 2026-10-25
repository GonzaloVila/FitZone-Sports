<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, BotonFz, IconoFz, InsigniaFz, PaginacionFz } from '@/ui'
import FiltrosSocios from '../components/FiltrosSocios.vue'
import TablaSocios from '../components/TablaSocios.vue'
import { useListaSocios } from '../composables/useListaSocios'
import type { AccionFila } from '../tipos'

const router = useRouter()
const {
  filtros,
  pagina,
  porPagina,
  items,
  total,
  totalPaginas,
  cargando,
  error,
  hayFiltrosActivos,
  limpiarFiltros,
  alternarRenovacion,
  guardandoRenovacion,
} = useListaSocios()
const { sedes, error: errorSedes, nombreDeSede } = useSedes()

const hayFilas = computed(() => items.value.length > 0)
const cargandoSinFilas = computed(() => cargando.value && !hayFilas.value)
const vacio = computed(() => !cargando.value && !hayFilas.value && !error.value)

// Rango mostrado en la página actual.
const rangoInicio = computed(() => (total.value === 0 ? 0 : (pagina.value - 1) * porPagina + 1))
const rangoFin = computed(() => Math.min(total.value, pagina.value * porPagina))

// La región del pie siempre está en el DOM (los lectores de pantalla solo anuncian cambios de una región
// existente); mientras no hay un resultado que informar, queda vacía.
const textoRango = computed(() => {
  if (cargandoSinFilas.value || error.value) return ''
  if (total.value === 0) return '0 socios'
  return `Mostrando ${rangoInicio.value} a ${rangoFin.value} de ${total.value} ${total.value === 1 ? 'socio' : 'socios'}`
})

// Las acciones con modal se resuelven en la ficha: la lista solo navega y avisa cuál se pidió.
function abrirAccion({ socioId, accion }: { socioId: number; accion: AccionFila }) {
  void router.push({
    name: 'socio-detalle',
    params: { socioId },
    query: accion === 'ver-ficha' ? undefined : { accion },
  })
}
</script>

<template>
  <section class="socios">
    <header class="socios__encabezado">
      <div class="socios__titulos">
        <div class="socios__titulo-grupo">
          <h1 class="socios__titulo">Socios</h1>
          <InsigniaFz>{{ total }} {{ total === 1 ? 'socio' : 'socios' }}</InsigniaFz>
        </div>
        <p class="socios__subtitulo">Gestión de membresías, altas y consulta de socios.</p>
      </div>

      <RouterLink v-slot="{ href, navigate }" :to="{ name: 'socios-nuevo' }" custom>
        <BotonFz como="a" :href="href" @click="navigate">
          <IconoFz nombre="mas" tamano="sm" />
          Nuevo socio
        </BotonFz>
      </RouterLink>
    </header>

    <FiltrosSocios
      v-model:nombre="filtros.nombre"
      v-model:estado="filtros.estado"
      v-model:plan="filtros.plan"
      v-model:sede="filtros.sede"
      :sedes="sedes"
      :hay-filtros-activos="hayFiltrosActivos"
      @limpiar="limpiarFiltros"
    />

    <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <TablaSocios
      v-if="hayFilas"
      :filas="items"
      :nombre-sede="nombreDeSede"
      :ocupada="cargando"
      :guardando-renovacion="guardandoRenovacion"
      @alternar-renovacion="alternarRenovacion"
      @abrir-accion="abrirAccion"
    />

    <p v-else-if="cargandoSinFilas" class="socios__estado" role="status">Cargando socios…</p>

    <div v-else-if="vacio" class="socios__vacio">
      <template v-if="hayFiltrosActivos">
        <p class="socios__estado">No se encontraron socios con los filtros aplicados.</p>
        <BotonFz variante="secundario" @click="limpiarFiltros">Limpiar filtros</BotonFz>
      </template>
      <template v-else>
        <p class="socios__estado">Todavía no hay socios.</p>
        <RouterLink v-slot="{ href, navigate }" :to="{ name: 'socios-nuevo' }" custom>
          <BotonFz como="a" :href="href" @click="navigate">
            <IconoFz nombre="mas" tamano="sm" />
            Nuevo socio
          </BotonFz>
        </RouterLink>
      </template>
    </div>

    <footer class="socios__pie">
      <p class="socios__rango" role="status" aria-live="polite" aria-atomic="true">{{ textoRango }}</p>
      <PaginacionFz v-if="totalPaginas > 1" v-model="pagina" :total-paginas="totalPaginas" etiqueta="Paginación de socios" />
    </footer>
  </section>
</template>

<style scoped>
.socios {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.socios__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.socios__titulos {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.socios__titulo-grupo {
  display: flex;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.socios__titulo {
  margin: 0;
  color: var(--fz-color-texto);
  font-size: var(--fz-texto-titulo);
  font-weight: var(--fz-peso-enfasis);
}

.socios__subtitulo {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-cuerpo);
}

.socios__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.socios__vacio {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--fz-espaciado-compacto);
  padding: var(--fz-espaciado-amplio) 0;
}

.socios__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.socios__rango {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
