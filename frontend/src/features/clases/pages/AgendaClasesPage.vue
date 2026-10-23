<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, BotonFz, PaginacionFz } from '@/ui'
import FiltrosClases from '../components/FiltrosClases.vue'
import TablaClases from '../components/TablaClases.vue'
import { POR_PAGINA_CLASES, useAgendaClases } from '../composables/useAgendaClases'

const { filtros, pagina, items, total, totalPaginas, cargando, error } = useAgendaClases()
const { sedes, error: errorSedes, nombreDeSede } = useSedes()
const { rol } = useUsuarioSesion()

const hayFilas = computed(() => items.value.length > 0)
const puedeCrear = computed(() => rol.value === 'RECEPCION' || rol.value === 'GERENTE')
const rangoInicio = computed(() => (total.value === 0 ? 0 : (pagina.value - 1) * POR_PAGINA_CLASES + 1))
const rangoFin = computed(() => Math.min(total.value, pagina.value * POR_PAGINA_CLASES))
</script>

<template>
  <section class="agenda">
    <header class="agenda__encabezado">
      <div class="agenda__titulos">
        <h1 class="agenda__titulo">Clases</h1>
        <p class="agenda__subtitulo">Agenda de clases grupales por sede y disciplina.</p>
      </div>
      <RouterLink v-if="puedeCrear" :to="{ name: 'clases-nueva' }">
        <BotonFz variante="primario">+ Nueva clase</BotonFz>
      </RouterLink>
    </header>

    <FiltrosClases v-model:tipo="filtros.tipo" v-model:sede="filtros.sede" :sedes="sedes" :total-resultados="total" />

    <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <p v-if="cargando && !hayFilas" class="agenda__cargando" role="status">Cargando clases…</p>

    <TablaClases v-if="hayFilas" :clases="items" :nombre-sede="nombreDeSede" :ocupada="cargando" />

    <div v-else-if="!cargando && !error" class="agenda__vacio">
      <h2 class="agenda__vacio-titulo">No hay clases para mostrar</h2>
      <p class="agenda__vacio-descripcion">
        No se encontraron clases con los filtros elegidos. Probá con otra sede o disciplina.
      </p>
    </div>

    <footer v-if="hayFilas" class="agenda__pie">
      <span class="agenda__pie-rango">
        Mostrando <strong>{{ rangoInicio }}</strong> a <strong>{{ rangoFin }}</strong> de
        <strong>{{ total }}</strong> clases
      </span>
      <div v-if="totalPaginas > 1" class="agenda__pie-paginacion">
        <PaginacionFz v-model="pagina" :total-paginas="totalPaginas" etiqueta="Paginación de clases" />
      </div>
    </footer>
  </section>
</template>

<style scoped>
.agenda {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 64rem;
  margin: 0 auto;
  width: 100%;
}

.agenda__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.agenda__titulos {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.agenda__titulo {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fz-color-texto);
}

.agenda__subtitulo {
  margin: 0;
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}

.agenda__cargando {
  margin: 0;
  color: var(--fz-color-texto-suave);
}

.agenda__vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1.5rem;
  text-align: center;
  background: var(--fz-color-superficie);
  border: 1px dashed var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
}

.agenda__vacio-titulo {
  margin: 0;
  font-size: 1.125rem;
  color: var(--fz-color-texto);
}

.agenda__vacio-descripcion {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}

.agenda__pie {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--fz-color-borde);
}

.agenda__pie-rango {
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}

.agenda__pie-rango strong {
  color: var(--fz-color-texto);
}

.agenda__pie-paginacion {
  margin-left: auto;
}
</style>
