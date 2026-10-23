<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, PaginacionFz } from '@/ui'
import FiltrosSocios from '../components/FiltrosSocios.vue'
import TablaSocios from '../components/TablaSocios.vue'
import { useListaSocios } from '../composables/useListaSocios'

const { filtros, pagina, items, total, totalPaginas, cargando, error } = useListaSocios()
const { sedes, error: errorSedes, nombreDeSede } = useSedes()

const hayFilas = computed(() => items.value.length > 0)

// Texto de la región aria-live: anuncia la cantidad de resultados o el estado de la consulta.
const mensajeResultados = computed(() => {
  if (error.value) return ''
  if (cargando.value) return 'Cargando socios…'
  if (total.value === 0) return 'No hay socios con esos filtros'
  return total.value === 1 ? '1 socio' : `${total.value} socios`
})
</script>

<template>
  <section class="socios">
    <div class="socios__encabezado">
      <h1 class="socios__titulo">Socios</h1>
      <RouterLink :to="{ name: 'socios-nuevo' }" class="socios__nuevo">Nuevo socio</RouterLink>
    </div>

    <FiltrosSocios
      v-model:nombre="filtros.nombre"
      v-model:estado="filtros.estado"
      v-model:plan="filtros.plan"
      v-model:sede="filtros.sede"
      :sedes="sedes"
    />

    <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <p class="socios__resultados" aria-live="polite">{{ mensajeResultados }}</p>

    <TablaSocios v-if="hayFilas" :filas="items" :nombre-sede="nombreDeSede" :ocupada="cargando" />

    <PaginacionFz
      v-if="hayFilas && totalPaginas > 1"
      v-model="pagina"
      :total-paginas="totalPaginas"
      etiqueta="Paginación de socios"
    />
  </section>
</template>

<style scoped>
.socios {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.socios__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

/* Es un enlace (navega), con el aspecto del botón primario. */
.socios__nuevo {
  display: inline-flex;
  align-items: center;
  min-height: var(--fz-boton-alto-md);
  padding: 0 var(--fz-boton-relleno-x-md);
  border-radius: var(--fz-boton-radio);
  background: var(--fz-boton-primario-fondo);
  color: var(--fz-boton-primario-texto);
  font-size: var(--fz-boton-texto-md);
  font-weight: var(--fz-boton-peso);
  text-decoration: none;
}

.socios__nuevo:hover {
  background: var(--fz-boton-primario-fondo-hover);
}

.socios__nuevo:focus-visible {
  outline: var(--fz-boton-foco-ancho) solid var(--fz-boton-foco-color);
  outline-offset: var(--fz-boton-foco-separacion);
}

.socios__titulo {
  margin: 0;
  font-size: var(--fz-texto-titulo);
  font-weight: var(--fz-peso-enfasis);
}

.socios__resultados {
  margin: 0;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}
</style>
