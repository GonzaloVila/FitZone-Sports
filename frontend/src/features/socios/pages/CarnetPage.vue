<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, BotonFz, ModalFz, QrFz } from '@/ui'
import CarnetSocio from '../components/CarnetSocio.vue'
import { useCarnet } from '../composables/useCarnet'
import { ETIQUETAS_ESTADO, ETIQUETAS_PLAN, VARIANTES_ESTADO, formatearVigencia } from '../presentacion'

const {
  estado,
  error,
  socio,
  membresia,
  usuario,
  sinSocio,
  qrUri,
  secreto,
  mensajeQr,
  generando,
  errorQr,
  generarQr,
  descartarQr,
  limpiarErrorQr,
} = useCarnet()
const { error: errorSedes, nombreDeSede } = useSedes()

const modalAbierto = ref(false)

function abrirModal() {
  limpiarErrorQr()
  modalAbierto.value = true
}

async function confirmar() {
  if (await generarQr()) modalAbierto.value = false
}

// Si algo cierra el modal mientras se genera, no queda un error viejo para la próxima vez.
watch(modalAbierto, (abierto) => {
  if (!abierto) limpiarErrorQr()
})

const datosMembresia = computed(() => (membresia.value.situacion === 'disponible' ? membresia.value.valor : null))
const carnet = computed(() => {
  const m = datosMembresia.value
  return {
    dni: usuario.value.situacion === 'disponible' ? usuario.value.valor.dni : undefined,
    plan: m ? ETIQUETAS_PLAN[m.plan] : undefined,
    estado: m ? { etiqueta: ETIQUETAS_ESTADO[m.estado], variante: VARIANTES_ESTADO[m.estado] } : undefined,
    vigencia: m ? formatearVigencia(m.fechaInicio, m.fechaFin) : undefined,
  }
})
</script>

<template>
  <section class="carnet-pagina">
    <h1 class="carnet-pagina__titulo">Mi carnet</h1>

    <AvisoFz v-if="sinSocio" variante="peligro">
      Tu sesión no tiene un socio asociado, así que no hay carnet para mostrar.
    </AvisoFz>

    <p v-else-if="estado === 'cargando'" class="carnet-pagina__estado" aria-live="polite">Cargando tu carnet…</p>

    <AvisoFz v-else-if="estado === 'no-existe'" variante="advertencia">No se encontró tu registro de socio.</AvisoFz>

    <AvisoFz v-else-if="estado === 'error'" variante="peligro">{{ error }}</AvisoFz>

    <template v-else-if="socio">
      <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>

      <CarnetSocio
        :nombre="socio.nombre"
        :dni="carnet.dni"
        :plan="carnet.plan"
        :estado="carnet.estado"
        :vigencia="carnet.vigencia"
        :sede="nombreDeSede(socio.sedeOrigenId)"
      />

      <section class="carnet-pagina__seccion" aria-labelledby="carnet-acceso">
        <h2 id="carnet-acceso" class="carnet-pagina__subtitulo">Acceso al gimnasio</h2>
        <p class="carnet-pagina__texto">
          El código de ingreso lo genera la app de autenticación del socio. Para vincularla, activá el QR de acceso y
          escanealo con esa app.
        </p>

        <div>
          <BotonFz variante="secundario" @click="abrirModal">Activar o regenerar QR de acceso</BotonFz>
        </div>

        <div v-if="qrUri" class="carnet-pagina__qr">
          <QrFz :texto="qrUri" alt="Código QR para vincular tu app de autenticación" />
          <p v-if="mensajeQr" class="carnet-pagina__texto">{{ mensajeQr }}</p>
          <p v-if="secreto" class="carnet-pagina__texto">
            Si no podés escanearlo, cargá este código a mano en la app:
            <code class="carnet-pagina__secreto">{{ secreto }}</code>
          </p>
          <div>
            <BotonFz variante="fantasma" tamano="sm" @click="descartarQr">Ocultar código</BotonFz>
          </div>
        </div>
      </section>
    </template>

    <ModalFz v-model="modalAbierto" titulo="Activar o regenerar el QR de acceso" :ocupado="generando">
      <p class="carnet-pagina__texto">
        Esta acción reemplaza el código anterior. Después vas a tener que volver a configurar la app de autenticación
        del socio con el código nuevo.
      </p>
      <AvisoFz v-if="errorQr" variante="peligro">{{ errorQr }}</AvisoFz>

      <template #acciones="{ cerrar }">
        <BotonFz variante="secundario" :disabled="generando" @click="cerrar">Cancelar</BotonFz>
        <BotonFz :cargando="generando" @click="confirmar">Generar código nuevo</BotonFz>
      </template>
    </ModalFz>
  </section>
</template>

<style scoped>
.carnet-pagina {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
}

.carnet-pagina__titulo {
  margin: 0;
  font-size: var(--fz-texto-titulo);
  font-weight: var(--fz-peso-enfasis);
}

.carnet-pagina__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
}

.carnet-pagina__seccion {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--fz-espaciado-base);
}

.carnet-pagina__subtitulo {
  margin: 0;
  font-size: var(--fz-texto-cuerpo);
  font-weight: var(--fz-peso-enfasis);
}

.carnet-pagina__texto {
  margin: 0;
  max-width: 36rem;
}

.carnet-pagina__qr {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--fz-espaciado-base);
}

.carnet-pagina__secreto {
  display: block;
  margin-top: var(--fz-espaciado-compacto);
  font-family: var(--fz-fuente-mono);
  overflow-wrap: anywhere;
  user-select: all;
}
</style>
