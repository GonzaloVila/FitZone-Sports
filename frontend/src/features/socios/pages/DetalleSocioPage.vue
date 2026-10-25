<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz } from '@/ui'
import AccionesSocio from '../components/AccionesSocio.vue'
import CarnetSocio from '../components/CarnetSocio.vue'
import FichaSocio from '../components/FichaSocio.vue'
import { useDetalleSocio } from '../composables/useDetalleSocio'
import { ETIQUETAS_ESTADO, ETIQUETAS_PLAN, VARIANTES_ESTADO, formatearVigencia } from '../presentacion'

const route = useRoute()
const router = useRouter()

// Aviso de alta: llega como ?alta=1 desde el formulario y se consume una sola vez (no queda en la URL).
const avisoAlta = ref(route.query.alta === '1')
onMounted(() => {
  if (avisoAlta.value) void router.replace({ name: 'socio-detalle', params: route.params })
})

// Un id que no sea un entero positivo se trata como socio inexistente, sin pedir nada a la API.
const socioId = computed(() => {
  const valor = route.params.socioId
  const texto = typeof valor === 'string' ? valor : ''
  const numero = Number(texto)
  return /^[1-9]\d*$/.test(texto) && Number.isSafeInteger(numero) ? numero : null
})

const {
  estado,
  error,
  socio,
  membresia,
  usuario,
  ejecutando,
  errorAccion,
  exito,
  suspender,
  reactivar,
  cambiarPlan,
  alternarRenovacion,
  cambiarSede,
  dejarDeSerSocio,
  limpiarErrorAccion,
} = useDetalleSocio(socioId)
const { sedes, error: errorSedes, nombreDeSede } = useSedes()

const datosMembresia = computed(() => (membresia.value.situacion === 'disponible' ? membresia.value.valor : null))

// Datos del carnet (sin QR: el QR lo genera el propio socio desde "Mi carnet").
const carnet = computed(() => {
  const m = datosMembresia.value
  return {
    dni: usuario.value.situacion === 'disponible' ? usuario.value.valor.dni : undefined,
    plan: m ? ETIQUETAS_PLAN[m.plan] : undefined,
    estado: m ? { etiqueta: ETIQUETAS_ESTADO[m.estado], variante: VARIANTES_ESTADO[m.estado] } : undefined,
    vigencia: m ? formatearVigencia(m.fechaInicio, m.fechaFin) : undefined,
  }
})

async function alDejarDeSerSocio() {
  if (await dejarDeSerSocio()) await router.push({ name: 'socios' })
}
</script>

<template>
  <section class="detalle">
    <RouterLink :to="{ name: 'socios' }" class="detalle__volver">Volver a socios</RouterLink>

    <h1 class="detalle__titulo">{{ socio?.nombre ?? 'Socio' }}</h1>

    <p v-if="estado === 'cargando'" class="detalle__estado" aria-live="polite">Cargando socio…</p>

    <AvisoFz v-else-if="estado === 'no-existe'" variante="advertencia">
      El socio no existe o ya no es socio.
    </AvisoFz>

    <AvisoFz v-else-if="estado === 'error'" variante="peligro">{{ error }}</AvisoFz>

    <template v-else-if="socio">
      <div aria-live="polite">
        <AvisoFz v-if="exito" variante="exito">{{ exito }}</AvisoFz>
        <AvisoFz v-else-if="avisoAlta" variante="exito">El socio se dio de alta correctamente.</AvisoFz>
      </div>
      <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>

      <FichaSocio
        :socio="socio"
        :usuario="usuario"
        :membresia="membresia"
        :nombre-sede="nombreDeSede(socio.sedeOrigenId)"
      />

      <section class="detalle__seccion" aria-labelledby="detalle-acciones">
        <h2 id="detalle-acciones" class="detalle__subtitulo">Acciones</h2>
        <AccionesSocio
          :socio="socio"
          :membresia="datosMembresia"
          :sede-actual-id="socio.sedeOrigenId"
          :sedes="sedes"
          :ejecutando="ejecutando"
          :error="errorAccion"
          @abrir="limpiarErrorAccion"
          @suspender="suspender"
          @reactivar="reactivar"
          @cambiar-plan="cambiarPlan"
          @alternar-renovacion="alternarRenovacion"
          @cambiar-sede="cambiarSede"
          @dejar-de-ser-socio="alDejarDeSerSocio"
        />
      </section>

      <section class="detalle__seccion" aria-labelledby="detalle-carnet">
        <h2 id="detalle-carnet" class="detalle__subtitulo">Carnet</h2>
        <CarnetSocio
          :nombre="socio.nombre"
          :socio-id="socio.id"
          :dni="carnet.dni"
          :plan="carnet.plan"
          :estado="carnet.estado"
          :vigencia="carnet.vigencia"
          :sede="nombreDeSede(socio.sedeOrigenId)"
        />
      </section>
    </template>
  </section>
</template>

<style scoped>
.detalle {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.detalle__volver {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: 1.5rem;
  color: var(--fz-color-primario);
}

.detalle__volver:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}

.detalle__titulo {
  margin: 0;
  font-size: var(--fz-texto-titulo);
  font-weight: var(--fz-peso-enfasis);
}

.detalle__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
}

.detalle__seccion {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

.detalle__subtitulo {
  margin: 0;
  font-size: var(--fz-texto-cuerpo);
  font-weight: var(--fz-peso-enfasis);
}
</style>
