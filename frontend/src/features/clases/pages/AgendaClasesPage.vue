<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSedeActiva } from '@/compartido/composables/useSedeActiva'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { useUsuarioSesion } from '@/features/sesion/composables/useUsuarioSesion'
import { AvisoFz, BotonFz, EncabezadoPaginaFz, IconoFz, InsigniaFz, PaginacionFz } from '@/ui'
import FiltrosClases from '../components/FiltrosClases.vue'
import ModalNuevaClase from '../components/modales/ModalNuevaClase.vue'
import TablaClases from '../components/TablaClases.vue'
import { POR_PAGINA_CLASES, useAgendaClases } from '../composables/useAgendaClases'

const { rol, sedeId: sedeUsuario } = useUsuarioSesion()
const { sedes, error: errorSedes, nombreDeSede } = useSedes()

const puedeCrear = computed(() => rol.value === 'RECEPCION' || rol.value === 'GERENTE')

// La sede activa se comparte con las otras pantallas de trabajo; el RECEPCION trabaja siempre en la suya. El filtro de la
// agenda arranca ahí para el personal; el SOCIO ve todas las sedes.
const sedeActiva = useSedeActiva(sedes, () => (rol.value === 'GERENTE' ? null : sedeUsuario.value))
const { filtros, pagina, items, total, totalPaginas, cargando, error, recargar } = useAgendaClases(() =>
  puedeCrear.value ? sedeActiva.value : null,
)

const hayFilas = computed(() => items.value.length > 0)
const cargandoSinFilas = computed(() => cargando.value && !hayFilas.value)
const vacio = computed(() => !cargando.value && !hayFilas.value && !error.value)

const rangoInicio = computed(() => (total.value === 0 ? 0 : (pagina.value - 1) * POR_PAGINA_CLASES + 1))
const rangoFin = computed(() => Math.min(total.value, pagina.value * POR_PAGINA_CLASES))

// La región del pie siempre está en el DOM (los lectores de pantalla solo anuncian cambios de una región existente);
// mientras no hay un resultado que informar, queda vacía.
const textoRango = computed(() => {
  if (cargandoSinFilas.value || error.value) return ''
  if (total.value === 0) return '0 clases'
  return `Mostrando ${rangoInicio.value} a ${rangoFin.value} de ${total.value} ${total.value === 1 ? 'clase' : 'clases'}`
})

const altaAbierta = ref(false)
</script>

<template>
  <section class="agenda">
    <EncabezadoPaginaFz titulo="Clases" subtitulo="Agenda de clases grupales por sede y disciplina.">
      <template #insignia>
        <InsigniaFz>{{ total }} {{ total === 1 ? 'clase' : 'clases' }}</InsigniaFz>
      </template>
      <template v-if="puedeCrear" #acciones>
        <BotonFz @click="altaAbierta = true">
          <IconoFz nombre="mas" tamano="sm" />
          Nueva clase
        </BotonFz>
      </template>
    </EncabezadoPaginaFz>

    <FiltrosClases v-model:tipo="filtros.tipo" v-model:sede="filtros.sede" :sedes="sedes" />

    <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>

    <TablaClases v-if="hayFilas" :clases="items" :nombre-sede="nombreDeSede" :ocupada="cargando" />

    <p v-else-if="cargandoSinFilas" class="agenda__estado" role="status">Cargando clases…</p>

    <p v-else-if="vacio" class="agenda__estado agenda__vacio">
      No se encontraron clases con los filtros elegidos. Probá con otra sede o disciplina.
    </p>

    <footer class="agenda__pie">
      <p class="agenda__rango" role="status" aria-live="polite" aria-atomic="true">{{ textoRango }}</p>
      <PaginacionFz v-if="totalPaginas > 1" v-model="pagina" :total-paginas="totalPaginas" etiqueta="Paginación de clases" />
    </footer>

    <ModalNuevaClase v-if="puedeCrear" v-model:abierto="altaAbierta" :sedes="sedes" :sede-inicial="sedeActiva" @creada="recargar" />
  </section>
</template>

<style scoped>
.agenda {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.agenda__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.agenda__vacio {
  padding: var(--fz-espaciado-amplio) 0;
}

.agenda__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.agenda__rango {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
