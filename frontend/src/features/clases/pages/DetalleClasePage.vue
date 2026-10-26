<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, BotonFz, EncabezadoPaginaFz, InsigniaFz } from '@/ui'
import AccionesClase from '../components/AccionesClase.vue'
import DatosClase from '../components/DatosClase.vue'
import ListaEsperaClase from '../components/ListaEsperaClase.vue'
import ListaInscriptos from '../components/ListaInscriptos.vue'
import ModalCancelarClase from '../components/ModalCancelarClase.vue'
import { useDetalleClase } from '../composables/useDetalleClase'
import { estadoDeClase, formatearHorario } from '../presentacion'

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

const estado = computed(() => (clase.value ? estadoDeClase(clase.value, ahora.value) : null))
const conAcciones = computed(() => Boolean(clase.value) && ((esSocio.value && !reservaCancelada.value) || Boolean(pagoPenalidad.value)))

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
    <EncabezadoPaginaFz
      :titulo="clase?.tipo ?? 'Clase'"
      :subtitulo="clase ? formatearHorario(clase) : undefined"
      :volver="{ texto: 'Volver a la agenda', a: { name: 'clases' } }"
    >
      <template v-if="estado" #insignia>
        <InsigniaFz :variante="estado.variante">{{ estado.etiqueta }}</InsigniaFz>
      </template>
      <template v-if="clase && conAcciones" #acciones>
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
        <BotonFz
          v-if="pagoPenalidad"
          variante="secundario"
          :cargando="descargandoComprobante"
          :disabled="descargandoComprobante"
          @click="descargarComprobantePenalidad"
        >
          Descargar comprobante
        </BotonFz>
      </template>
    </EncabezadoPaginaFz>

    <p v-if="cargando" class="detalle__estado" role="status">Cargando clase…</p>

    <AvisoFz v-else-if="noExiste" variante="advertencia">La clase que buscás no existe.</AvisoFz>
    <AvisoFz v-else-if="error && !clase" variante="peligro">{{ error }}</AvisoFz>

    <template v-else-if="clase">
      <AvisoFz v-if="error" variante="advertencia">{{ error }}</AvisoFz>
      <AvisoFz v-if="errorAccion && !modalCancelar" variante="peligro">{{ errorAccion }}</AvisoFz>
      <AvisoFz v-if="exitoAccion" variante="exito">{{ exitoAccion }}</AvisoFz>
      <AvisoFz v-if="errorDescarga" variante="peligro">{{ errorDescarga }}</AvisoFz>

      <DatosClase :clase="clase" :nombre-sede="nombreDeSede(clase.sedeId)" />

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
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.detalle__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.detalle__seccion {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.detalle__seccion-titulo {
  margin: 0;
  color: var(--fz-color-texto);
  font-size: var(--fz-texto-subtitulo);
  font-weight: var(--fz-peso-enfasis);
}
</style>
