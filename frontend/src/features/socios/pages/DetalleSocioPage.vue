<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useSedes } from '@/features/sedes/composables/useSedes'
import type { UsuarioPatch } from '@/features/usuarios/services/servicioUsuarios'
import { AvisoFz, IconoFz } from '@/ui'
import FichaSocio from '../components/FichaSocio.vue'
import ModalCambiarSede from '../components/modales/ModalCambiarSede.vue'
import ModalEditarDatos from '../components/modales/ModalEditarDatos.vue'
import ModalesAccionSocio from '../components/modales/ModalesAccionSocio.vue'
import { useAccionesSocio } from '../composables/useAccionesSocio'
import { useDetalleSocio } from '../composables/useDetalleSocio'
import { datosIniciales } from '../edicionDatos'
import { filaDeSocio } from '../presentacion'
import type { AccionFicha } from '../tipos'

const route = useRoute()
const router = useRouter()

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
  erroresCampos,
  reemplazarMembresia,
  alternarRenovacion,
  cambiarSede,
  editarDatos,
  limpiarErrorAccion,
} = useDetalleSocio(socioId)
const { sedes, error: errorSedes, nombreDeSede } = useSedes()

// Cambiar plan, suspender, reactivar y dejar de ser socio usan los mismos modales que la lista. Al terminar bien, la
// ficha muestra la membresía que devolvió el servidor; si fue una baja, el socio ya no existe y se vuelve a la lista.
const acciones = useAccionesSocio((resultado) => {
  if ('baja' in resultado) void router.push({ name: 'socios' })
  else reemplazarMembresia(resultado.membresia)
})

// Cambiar sede y editar datos tienen su propio modal, manejado acá con lo que expone useDetalleSocio.
const sedeAbierta = ref(false)
const edicionAbierta = ref(false)
const datosOriginales = computed(() =>
  datosIniciales(socio.value?.nombre ?? '', usuario.value.situacion === 'disponible' ? usuario.value.valor : null),
)

function abrirAccion(accion: AccionFicha) {
  if (accion === 'cambiar-sede' || accion === 'editar-datos') {
    limpiarErrorAccion()
    if (accion === 'cambiar-sede') sedeAbierta.value = true
    else edicionAbierta.value = true
  } else if (socio.value) {
    acciones.abrir(filaDeSocio(socio.value, membresia.value), accion)
  }
}

async function confirmarSede(sedeId: number) {
  if (await cambiarSede(sedeId)) sedeAbierta.value = false
}

async function confirmarEdicion(cambios: UsuarioPatch) {
  if (await editarDatos(cambios)) edicionAbierta.value = false
}

// Al cerrarse un modal (Cancelar, X, Esc o éxito) el foco vuelve al botón "···": el ítem del menú o el botón del aviso que
// lo abrió ya no existe o cambió. Se espera a que el modal termine de cerrarse para que su propia devolución de foco no pise esta.
const hayModal = computed(() => acciones.pedido.value !== null || sedeAbierta.value || edicionAbierta.value)
watch(hayModal, async (abierto, estabaAbierto) => {
  if (abierto || !estabaAbierto || !socio.value) return
  const identificador = `menu-socio-${socio.value.id}`
  await nextTick()
  document.querySelector<HTMLElement>(`[data-identificador="${identificador}"]`)?.focus()
})
</script>

<template>
  <section class="detalle">
    <RouterLink :to="{ name: 'socios' }" class="detalle__volver">
      <IconoFz nombre="flecha-izquierda" tamano="sm" />
      Volver a socios
    </RouterLink>

    <h1 class="detalle__titulo">Ficha del socio</h1>

    <p v-if="estado === 'cargando'" class="detalle__estado" aria-live="polite">Cargando socio…</p>

    <AvisoFz v-else-if="estado === 'no-existe'" variante="advertencia">
      El socio no existe o ya no es socio.
    </AvisoFz>

    <AvisoFz v-else-if="estado === 'error'" variante="peligro">{{ error }}</AvisoFz>

    <template v-else-if="socio">
      <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>

      <FichaSocio
        :socio="socio"
        :usuario="usuario"
        :membresia="membresia"
        :nombre-sede="nombreDeSede(socio.sedeOrigenId)"
        :guardando-renovacion="ejecutando === 'renovacion-automatica'"
        @abrir-accion="abrirAccion"
        @alternar-renovacion="alternarRenovacion"
      />

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

      <ModalCambiarSede
        v-model:abierto="sedeAbierta"
        :sedes="sedes"
        :sede-actual-id="socio.sedeOrigenId"
        :ejecutando="ejecutando === 'cambiar-sede'"
        :error="errorAccion"
        @confirmar="confirmarSede"
      />

      <ModalEditarDatos
        v-model:abierto="edicionAbierta"
        :original="datosOriginales"
        :ejecutando="ejecutando === 'editar-datos'"
        :error="errorAccion"
        :errores="erroresCampos"
        @confirmar="confirmarEdicion"
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
  max-width: 28rem;
  margin-inline: auto;
}

.detalle__volver {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: var(--fz-espaciado-compacto);
  min-height: 1.5rem;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
  text-decoration: none;
}

.detalle__volver:hover {
  color: var(--fz-color-texto);
}

.detalle__volver:focus-visible {
  outline: 2px solid var(--fz-color-foco);
  outline-offset: 2px;
}

.detalle__titulo {
  margin: 0;
  font-size: var(--fz-texto-titulo);
  font-weight: var(--fz-peso-enfasis);
  letter-spacing: var(--fz-letras-apretado);
}

.detalle__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
}
</style>
