<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, BotonFz, IconoFz, InsigniaFz, PaginacionFz } from '@/ui'
import FiltrosSocios from '../components/FiltrosSocios.vue'
import ModalesAccionSocio from '../components/modales/ModalesAccionSocio.vue'
import TablaSocios from '../components/TablaSocios.vue'
import { useAccionesSocio } from '../composables/useAccionesSocio'
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
  reemplazarMembresia,
  recargar,
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

const titulo = useTemplateRef<HTMLElement>('titulo')

// Las acciones con modal se resuelven acá mismo: al terminar bien, la fila se actualiza con lo que devolvió el
// servidor y, si fue una baja, se vuelve a consultar la página (la fila ya no existe).
const acciones = useAccionesSocio(async (resultado) => {
  if (!('baja' in resultado)) return reemplazarMembresia(resultado.socioId, resultado.membresia)
  await recargar()
  await nextTick()
  titulo.value?.focus()
})

function abrirAccion({ socioId, accion }: { socioId: number; accion: AccionFila }) {
  if (accion === 'ver-ficha') {
    void router.push({ name: 'socio-detalle', params: { socioId } })
    return
  }
  const fila = items.value.find((candidata) => candidata.socio.id === socioId)
  if (fila) acciones.abrir(fila, accion)
}

// Al cerrarse el modal (Cancelar, X, Esc o éxito) el foco vuelve al botón "···" de esa fila: el ítem del menú que
// lo abrió ya no existe. Se espera a que el modal termine de cerrarse para que su propia devolución de foco no pise esta.
watch(acciones.pedido, async (nuevo, previo) => {
  if (nuevo || !previo) return
  await nextTick()
  document.querySelector<HTMLElement>(`[data-identificador="menu-socio-${previo.fila.socio.id}"]`)?.focus()
})
</script>

<template>
  <section class="socios">
    <header class="socios__encabezado">
      <div class="socios__titulos">
        <div class="socios__titulo-grupo">
          <h1 ref="titulo" class="socios__titulo" tabindex="-1">Socios</h1>
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

    <p v-else-if="vacio" class="socios__estado socios__vacio">
      {{ hayFiltrosActivos ? 'No se encontraron socios con los filtros aplicados.' : 'Todavía no hay socios.' }}
    </p>

    <ModalesAccionSocio
      :accion="acciones.accion.value"
      :socio="acciones.socio.value"
      :membresia="acciones.membresia.value"
      :ejecutando="acciones.ejecutando.value"
      :error="acciones.error.value"
      @cerrar="acciones.cerrar"
      @confirmar-plan="acciones.confirmarPlan"
      @suspender="acciones.suspender"
      @reactivar="acciones.reactivar"
      @dejar-de-ser-socio="acciones.dejarDeSerSocio"
    />

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
  outline: none;
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
