<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, BotonFz, PaginacionFz, SelectFz } from '@/ui'
import ListaCanchas from '../components/ListaCanchas.vue'
import { useCanchas } from '../composables/useCanchas'
import { ESTADOS_CANCHA, ETIQUETA_ESTADO_CANCHA } from '../presentacion'

const {
  sedes,
  cargandoSedes,
  errorSedes,
  sede,
  estado,
  pagina,
  items,
  total,
  totalPaginas,
  cargando,
  error,
} = useCanchas()
const { rol } = useUsuarioSesion()

const hayFilas = computed(() => items.value.length > 0)
</script>

<template>
  <section class="canchas">
    <header class="canchas__encabezado">
      <div class="canchas__titulos">
        <h1 class="canchas__titulo">Canchas</h1>
        <p class="canchas__subtitulo">Elegí una sede para ver sus canchas y reservar un turno.</p>
      </div>
      <RouterLink v-if="rol === 'GERENTE'" :to="{ name: 'canchas-gestion' }">
        <BotonFz variante="secundario">Gestionar canchas</BotonFz>
      </RouterLink>
    </header>

    <div class="canchas__filtros">
      <label class="canchas__campo">
        <span class="canchas__etiqueta">Sede</span>
        <SelectFz v-model="sede" :disabled="cargandoSedes">
          <option value="">Elegí una sede</option>
          <option v-for="opcion in sedes" :key="opcion.id" :value="String(opcion.id)">
            {{ opcion.nombre }}
          </option>
        </SelectFz>
      </label>
      <label class="canchas__campo">
        <span class="canchas__etiqueta">Estado</span>
        <SelectFz v-model="estado">
          <option value="">Todas</option>
          <option v-for="valor in ESTADOS_CANCHA" :key="valor" :value="valor">
            {{ ETIQUETA_ESTADO_CANCHA[valor] }}
          </option>
        </SelectFz>
      </label>
    </div>

    <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <ListaCanchas v-if="hayFilas" :canchas="items" :ocupada="cargando" />

    <div v-else-if="!cargando && sede" class="canchas__vacio">
      <h2 class="canchas__vacio-titulo">No hay canchas</h2>
      <p class="canchas__vacio-texto">La sede elegida no tiene canchas con ese estado.</p>
    </div>
    <p v-else-if="!sede" class="canchas__ayuda">Elegí una sede para empezar.</p>

    <footer v-if="hayFilas" class="canchas__pie">
      <span class="canchas__rango">{{ total }} {{ total === 1 ? 'cancha' : 'canchas' }}</span>
      <PaginacionFz
        v-if="totalPaginas > 1"
        v-model="pagina"
        :total-paginas="totalPaginas"
        etiqueta="Paginación de canchas"
      />
    </footer>
  </section>
</template>

<style scoped>
.canchas {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 64rem;
  margin: 0 auto;
  width: 100%;
}

.canchas__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.canchas__titulo {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fz-color-texto);
}

.canchas__subtitulo {
  margin: 0;
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}

.canchas__filtros {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--fz-espaciado-base);
}

.canchas__campo {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.canchas__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: 600;
  color: var(--fz-color-texto);
}

.canchas__ayuda,
.canchas__vacio-texto {
  margin: 0;
  color: var(--fz-color-texto-suave);
}

.canchas__vacio {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 3rem 1.5rem;
  text-align: center;
  border: 1px dashed var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  background: var(--fz-color-superficie);
}

.canchas__vacio-titulo {
  margin: 0;
  font-size: 1.125rem;
  color: var(--fz-color-texto);
}

.canchas__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--fz-color-borde);
}

.canchas__rango {
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}
</style>
