<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, BotonFz, InsigniaFz, PaginacionFz, SelectFz } from '@/ui'
import FiltrosSocios from '../components/FiltrosSocios.vue'
import TablaSocios from '../components/TablaSocios.vue'
import { useListaSocios } from '../composables/useListaSocios'

const { filtros, pagina, items, total, totalPaginas, cargando, error } = useListaSocios()
const { sedes, error: errorSedes, nombreDeSede } = useSedes()

const hayFilas = computed(() => items.value.length > 0)

// Cálculo del rango mostrado en la página actual
const rangoInicio = computed(() => (total.value === 0 ? 0 : (pagina.value - 1) * 10 + 1))
const rangoFin = computed(() => Math.min(total.value, pagina.value * 10))

// Función para exportar a CSV los socios cargados en pantalla
function exportarCsv() {
  if (items.value.length === 0) return

  const encabezados = ['ID Socio', 'Nombre', 'Email', 'Sede', 'Fecha Alta', 'Plan', 'Estado']
  const filasCsv = items.value.map((item) => [
    item.socio.id,
    `"${item.socio.nombre.replace(/"/g, '""')}"`,
    `"${item.socio.email}"`,
    `"${nombreDeSede(item.socio.sedeOrigenId)}"`,
    item.socio.fechaAlta ? new Date(item.socio.fechaAlta).toLocaleDateString() : '',
    item.membresia.situacion === 'disponible' ? item.membresia.membresia.plan : 'N/A',
    item.membresia.situacion === 'disponible' ? item.membresia.membresia.estado : 'N/A',
  ])

  const contenido = [encabezados.join(','), ...filasCsv.map((f) => f.join(','))].join('\n')
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `socios_fitzone_${new Date().toISOString().slice(0, 10)}.csv`)
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="socios">
    <!-- Cabecera moderna alineada con botón primario "+ Nuevo socio" -->
    <header class="socios__encabezado">
      <div class="socios__titulos">
        <div class="socios__titulo-grupo">
          <h1 class="socios__titulo">Socios</h1>
          <InsigniaFz variante="neutra" class="socios__badge-conteo">
            {{ total }} {{ total === 1 ? 'socio' : 'socios' }}
          </InsigniaFz>
        </div>
        <p class="socios__subtitulo">Gestión de membresías, altas y consulta de socios.</p>
      </div>

      <RouterLink :to="{ name: 'socios-nuevo' }">
        <BotonFz variante="primario">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 0.375rem;">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo socio
        </BotonFz>
      </RouterLink>
    </header>

    <!-- Toolbar unificada de búsqueda y filtros -->
    <FiltrosSocios
      v-model:nombre="filtros.nombre"
      v-model:estado="filtros.estado"
      v-model:plan="filtros.plan"
      v-model:sede="filtros.sede"
      :sedes="sedes"
      :total-resultados="total"
      @exportar="exportarCsv"
    />

    <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <!-- Tabla de socios con avatar e identidad unificada -->
    <TablaSocios
      v-if="hayFilas"
      :filas="items"
      :nombre-sede="nombreDeSede"
      :ocupada="cargando"
    />

    <!-- Estado vacío estilizado cuando no hay socios -->
    <div v-else-if="!cargando" class="socios__vacio">
      <div class="socios__vacio-icono" aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="7" r="4" />
          <path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2" />
        </svg>
      </div>
      <h3 class="socios__vacio-titulo">No se encontraron socios</h3>
      <p class="socios__vacio-descripcion">
        No hay registros que coincidan con los filtros aplicados o aún no se han dado de alta socios.
      </p>
      <RouterLink :to="{ name: 'socios-nuevo' }">
        <BotonFz variante="primario" tamano="sm">
          + Dar de alta nuevo socio
        </BotonFz>
      </RouterLink>
    </div>

    <!-- Pie de tabla integrado (Rango de resultados + Paginación) -->
    <footer v-if="hayFilas" class="socios__pie">
      <span class="socios__pie-rango">
        Mostrando <strong>{{ rangoInicio }}</strong> a <strong>{{ rangoFin }}</strong> de <strong>{{ total }}</strong> socios
      </span>

      <div v-if="totalPaginas > 1" class="socios__pie-paginacion">
        <PaginacionFz
          v-model="pagina"
          :total-paginas="totalPaginas"
          etiqueta="Paginación de socios"
        />
      </div>
    </footer>
  </section>
</template>

<style scoped>
.socios {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 64rem;
  margin: 0 auto;
  width: 100%;
}

.socios__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.socios__titulos {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.socios__titulo-grupo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.socios__titulo {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fz-color-texto);
}

.socios__badge-conteo {
  font-size: 0.8125rem;
}

.socios__subtitulo {
  margin: 0;
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}

/* Empty State */
.socios__vacio {
  background: var(--fz-color-superficie);
  border: 1px dashed var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  padding: 3.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.75rem;
  box-shadow: var(--fz-sombra-tarjeta);
}

.socios__vacio-icono {
  color: var(--fz-color-texto-suave);
  opacity: 0.6;
}

.socios__vacio-titulo {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--fz-color-texto);
}

.socios__vacio-descripcion {
  margin: 0 0 0.5rem;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
  max-width: 26rem;
}

/* Footer / Pie de tabla */
.socios__pie {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--fz-color-borde);
}

.socios__pie-rango {
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}

.socios__pie-rango strong {
  color: var(--fz-color-texto);
}

.socios__pie-paginacion {
  margin-left: auto;
}
</style>
