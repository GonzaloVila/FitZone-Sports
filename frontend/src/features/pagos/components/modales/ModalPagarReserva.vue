<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useServicios } from '@/compartido/servicios'
import type { ReservaCancha } from '@/features/canchas/services/servicioCanchas'
import { AvisoFz, BotonFz, CampoFormularioFz, ListaDatosFz, ModalFz, SelectFz, type DatoFz } from '@/ui'
import { useDescargaPdf } from '../../composables/useDescargaPdf'
import { usePagarReserva } from '../../composables/usePagarReserva'
import { ETIQUETA_ESTADO_PAGO, MEDIOS_PAGO, formatearDia, formatearMonto, rangoHorario } from '../../presentacion'

// Pago de una reserva de cancha. Quien lo abre ya tiene la reserva y el nombre de su cancha ("Fútbol 5 #2", que la reserva no
// trae): se los pasa, así este módulo no depende de la pantalla de canchas.
const props = defineProps<{
  reserva: ReservaCancha | null
  nombreCancha: string
}>()

const abierto = defineModel<boolean>('abierto', { required: true })
// Se emite al cerrar el modal después de un pago aprobado: la pantalla que lo abrió se actualiza para mostrar "Pagada".
const emit = defineEmits<{ pagado: [] }>()

const servicios = useServicios()
const idFormulario = useId()
const { medio, errorMedio, enviando, error, pago, pagar, reiniciar } = usePagarReserva(() => props.reserva)
const { descargando, error: errorDescarga, descargar } = useDescargaPdf()

// Cada vez que se abre arranca limpio (sin medio, sin errores, sin el resultado anterior); al cerrarse avisa si se pagó.
watch(abierto, (valor) => {
  if (valor) {
    reiniciar()
    errorDescarga.value = null
  } else if (pago.value?.estado === 'APROBADO') {
    emit('pagado')
  }
})

const datos = computed<DatoFz[]>(() => {
  const reserva = props.reserva
  if (!reserva) return []
  return [
    { etiqueta: 'Cancha', valor: props.nombreCancha },
    { etiqueta: 'Día', valor: formatearDia(reserva.fechaHoraInicio) },
    { etiqueta: 'Turno', valor: rangoHorario(reserva.fechaHoraInicio, reserva.fechaHoraFin) },
    { etiqueta: 'Monto', valor: formatearMonto(reserva.precioAplicado), destacado: true },
  ]
})

// Al pagar, el formulario (con el botón "Pagar" que tenía el foco) desaparece y aparece el resultado: sin hacer nada, el foco
// se perdería en el documento. Se lo lleva a la región del resultado (no a un botón: un Enter de más descargaría o cerraría
// sin querer). La región se anuncia por su nombre y su descripción (el texto del resultado), así que el aviso de adentro
// no repite el anuncio con su propio aria-live.
const regionResultado = ref<HTMLElement | null>(null)
const idTextoResultado = useId()
watch(pago, async (nuevo, anterior) => {
  if (!nuevo || anterior) return
  await nextTick()
  regionResultado.value?.focus()
})

const aprobado = computed(() => pago.value?.estado === 'APROBADO')
const varianteResultado = computed(() => {
  if (aprobado.value) return 'exito' as const
  return pago.value?.estado === 'PENDIENTE' ? ('advertencia' as const) : ('peligro' as const)
})
const textoResultado = computed(() =>
  pago.value ? `Pago ${ETIQUETA_ESTADO_PAGO[pago.value.estado].toLowerCase()} por ${formatearMonto(pago.value.monto)}.` : '',
)

function descargarComprobante() {
  const actual = pago.value
  if (!actual) return
  void descargar(`comprobante-${actual.id}.pdf`, () => servicios.pagos.descargarComprobante(actual.id))
}
</script>

<template>
  <ModalFz
    v-model="abierto"
    titulo="Pagar reserva"
    descripcion="Revisá el resumen y elegí con qué medio pagar."
    icono="pagos"
    tono="primario"
    ancho="angosto"
    :ocupado="enviando"
  >
    <div
      v-if="pago"
      ref="regionResultado"
      class="resultado"
      role="group"
      aria-label="Resultado del pago"
      :aria-describedby="idTextoResultado"
      tabindex="-1"
    >
      <AvisoFz :id="idTextoResultado" :variante="varianteResultado" aria-live="off">{{ textoResultado }}</AvisoFz>
      <!-- Este sí se anuncia solo (role="alert"): aparece después, con el foco ya en la región. -->
      <AvisoFz v-if="errorDescarga" variante="peligro">{{ errorDescarga }}</AvisoFz>
    </div>

    <template v-else>
      <ListaDatosFz :datos="datos" />

      <form :id="idFormulario" novalidate @submit.prevent="pagar">
        <CampoFormularioFz etiqueta="Medio de pago" etiqueta-chica obligatorio :error="errorMedio ?? undefined">
          <template #default="{ id, describedby, invalido }">
            <SelectFz
              :id="id"
              v-model="medio"
              name="medio"
              aria-required="true"
              :invalido="invalido"
              :aria-describedby="describedby"
              :disabled="enviando"
            >
              <option value="" disabled>Elegí un medio de pago</option>
              <option v-for="opcion in MEDIOS_PAGO" :key="opcion.valor" :value="opcion.valor">{{ opcion.etiqueta }}</option>
            </SelectFz>
          </template>
        </CampoFormularioFz>
      </form>

      <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    </template>

    <template #acciones="{ cerrar }">
      <template v-if="pago">
        <BotonFz v-if="aprobado" variante="secundario" :cargando="descargando" @click="descargarComprobante">
          Descargar comprobante
        </BotonFz>
        <BotonFz @click="cerrar">Cerrar</BotonFz>
      </template>
      <template v-else>
        <BotonFz variante="fantasma" :disabled="enviando" @click="cerrar">Cancelar</BotonFz>
        <BotonFz tipo="submit" :form="idFormulario" :cargando="enviando">
          {{ enviando ? 'Pagando…' : 'Pagar' }}
        </BotonFz>
      </template>
    </template>
  </ModalFz>
</template>

<style scoped>
.resultado {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

/* Solo recibe el foco por programa (tabindex="-1", no está en el orden del Tab) y no es un control: no necesita contorno.
   Los botones del modal conservan su anillo de foco. */
.resultado:focus {
  outline: none;
}
</style>
