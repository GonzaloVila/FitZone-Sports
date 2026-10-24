<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, BotonFz, InsigniaFz } from '@/ui'
import AccionesClase from '../components/AccionesClase.vue'
import ListaEsperaClase from '../components/ListaEsperaClase.vue'
import ListaInscriptos from '../components/ListaInscriptos.vue'
import ModalCancelarClase from '../components/ModalCancelarClase.vue'
import { useDetalleClase } from '../composables/useDetalleClase'
import { formatearHorario } from '../presentacion'

const route = useRoute()

// Un id que no sea un entero positivo se trata como clase inexistente, sin pedir nada a la API.
const claseId = computed(() => {
  const valor = route.params.claseId
  const texto = typeof valor === 'string' ? valor : ''
  const numero = Number(texto)
  return /^[1-9]\d*$/.test(texto) && Number.isSafeInteger(numero) ? numero : null
})

const {
  clase,
  reserva,
  espera,
  posicionEnEspera,
  inscriptos,
  listaEspera,
  ahora,
  cargando,
  error,
  noExiste,
  accionando,
  errorAccion,
  exitoAccion,
  reservaCancelada,
  pagoPenalidad,
  descargandoComprobante,
  errorDescarga,
  esSocio,
  esPersonal,
  reservar,
  cancelarReserva,
  descargarComprobantePenalidad,
  anotarseEnEspera,
  confirmarCupo,
  salirDeEspera,
} = useDetalleClase(() => claseId.value)
const { nombreDeSede } = useSedes()

const modalCancelar = ref(false)

async function confirmarCancelacion() {
  const ok = await cancelarReserva()
  if (ok) modalCancelar.value = false
}

function abrirCancelacion() {
  errorAccion.value = null
  exitoAccion.value = null
  modalCancelar.value = true
}
</script>

<template>
  <section class="detalle">
    <RouterLink :to="{ name: 'clases' }" class="detalle__volver">← Volver a la agenda</RouterLink>

    <p v-if="cargando" class="detalle__estado" role="status">Cargando clase…</p>

    <AvisoFz v-else-if="noExiste" variante="advertencia">La clase que buscás no existe.</AvisoFz>
    <AvisoFz v-else-if="error && !clase" variante="peligro">{{ error }}</AvisoFz>

    <template v-else-if="clase">
      <header class="detalle__encabezado">
        <h1 class="detalle__titulo">{{ clase.tipo }}</h1>
        <p class="detalle__subtitulo">{{ formatearHorario(clase) }}</p>
      </header>

      <AvisoFz v-if="error" variante="advertencia">{{ error }}</AvisoFz>

      <dl class="detalle__datos">
        <div>
          <dt>Instructor</dt>
          <dd>{{ clase.instructor }}</dd>
        </div>
        <div>
          <dt>Sede</dt>
          <dd>{{ nombreDeSede(clase.sedeId) }}</dd>
        </div>
        <div>
          <dt>Cupos</dt>
          <dd>
            <template v-if="clase.cupoDisponible > 0">
              {{ clase.cupoDisponible }} libres de {{ clase.capacidad }}
            </template>
            <InsigniaFz v-else variante="peligro">Sin cupos</InsigniaFz>
          </dd>
        </div>
        <div>
          <dt>Reservas confirmadas</dt>
          <dd>{{ clase.reservasConfirmadas }}</dd>
        </div>
      </dl>

      <AvisoFz v-if="errorAccion && !modalCancelar" variante="peligro">{{ errorAccion }}</AvisoFz>
      <AvisoFz v-if="exitoAccion" variante="exito">{{ exitoAccion }}</AvisoFz>
      <div v-if="pagoPenalidad || reservaCancelada" class="detalle__acciones">
        <BotonFz
          v-if="pagoPenalidad"
          variante="secundario"
          :cargando="descargandoComprobante"
          :disabled="descargandoComprobante"
          @click="descargarComprobantePenalidad"
        >
          Descargar comprobante
        </BotonFz>
        <RouterLink v-if="reservaCancelada" :to="{ name: 'clases' }">
          <BotonFz variante="primario">Volver a la agenda</BotonFz>
        </RouterLink>
      </div>
      <AvisoFz v-if="errorDescarga" variante="peligro">{{ errorDescarga }}</AvisoFz>

      <AccionesClase
        v-if="esSocio && !reservaCancelada"
        :clase="clase"
        :reserva="reserva"
        :espera="espera"
        :posicion-en-espera="posicionEnEspera"
        :ahora="ahora"
        :ocupado="accionando"
        @reservar="reservar"
        @cancelar="abrirCancelacion"
        @anotarse="anotarseEnEspera"
        @confirmar="confirmarCupo"
        @salir="salirDeEspera"
      />

      <template v-if="esPersonal">
        <section class="detalle__seccion" aria-labelledby="titulo-inscriptos">
          <h2 id="titulo-inscriptos" class="detalle__seccion-titulo">Inscriptos</h2>
          <ListaInscriptos :inscriptos="inscriptos" />
        </section>
        <section class="detalle__seccion" aria-labelledby="titulo-espera">
          <h2 id="titulo-espera" class="detalle__seccion-titulo">Lista de espera</h2>
          <ListaEsperaClase :espera="listaEspera" />
        </section>
      </template>

      <ModalCancelarClase
        v-model="modalCancelar"
        :clase="clase"
        :ahora="ahora"
        :cargando="accionando"
        :error="errorAccion"
        @confirmar="confirmarCancelacion"
      />
    </template>
  </section>
</template>

<style scoped>
.detalle {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 48rem;
  margin: 0 auto;
  width: 100%;
}

.detalle__volver {
  align-self: flex-start;
  color: var(--fz-color-primario);
  font-size: var(--fz-texto-pequeno);
}

.detalle__volver:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}

.detalle__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
}

.detalle__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fz-espaciado-compacto);
}

.detalle__encabezado {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detalle__titulo {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fz-color-texto);
}

.detalle__subtitulo {
  margin: 0;
  color: var(--fz-color-texto-suave);
  text-transform: capitalize;
}

.detalle__datos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--fz-espaciado-base);
  margin: 0;
  padding: var(--fz-espaciado-amplio);
  background: var(--fz-color-superficie);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  box-shadow: var(--fz-sombra-tarjeta);
}

.detalle__datos dt {
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}

.detalle__datos dd {
  margin: 0.25rem 0 0;
  font-weight: var(--fz-peso-enfasis);
  color: var(--fz-color-texto);
}

.detalle__seccion {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.detalle__seccion-titulo {
  margin: 0;
  font-size: 1.125rem;
  color: var(--fz-color-texto);
}
</style>
