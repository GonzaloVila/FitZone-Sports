<script setup lang="ts">
import { computed } from 'vue'
import { AvisoFz, InsigniaFz, MedidorFz } from '@/ui'
import { estadoDeOcupacion, type EstadoOcupacion } from '../ocupacion'
import type { Aforo } from '../services/servicioAcceso'

const props = defineProps<{
  aforo: Aforo | null
  nombreSede?: string
  cargando?: boolean
}>()

// Una sola regla (estadoDeOcupacion) decide la insignia, el color del número y el de la barra.
const ocupacion = computed<EstadoOcupacion | null>(() =>
  props.aforo ? estadoDeOcupacion(props.aforo.aforoActual, props.aforo.aforoMaximo) : null,
)
const estaLleno = computed(() => ocupacion.value === 'lleno')

const INSIGNIAS = {
  disponible: { texto: 'Disponible', variante: 'exito' },
  'casi-lleno': { texto: 'Casi lleno', variante: 'advertencia' },
  lleno: { texto: 'Lleno', variante: 'peligro' },
} as const

// El color de la barra, en los términos del kit (verde, ámbar, rojo).
const NIVELES_BARRA = { disponible: 'normal', 'casi-lleno': 'advertencia', lleno: 'critico' } as const

// Solo el número lleva color, y solo cuando el estado lo pide (neutro si hay lugar, ámbar si queda poco, rojo si no hay).
const TONOS_NUMERO = { disponible: 'normal', 'casi-lleno': 'advertencia', lleno: 'peligro' } as const

const insignia = computed(() => (ocupacion.value ? INSIGNIAS[ocupacion.value] : null))
const nivelBarra = computed(() => (ocupacion.value ? NIVELES_BARRA[ocupacion.value] : 'normal'))
const tonoOcupacion = computed(() => (ocupacion.value ? TONOS_NUMERO[ocupacion.value] : 'normal'))
const tonoDisponibles = computed(() => (estaLleno.value ? 'peligro' : 'normal'))
</script>

<template>
  <section class="tarjeta" aria-label="Aforo de la sede">
    <div class="tarjeta__cabecera">
      <div class="tarjeta__sede">
        <h2 class="tarjeta__nombre">{{ nombreSede ?? 'Aforo de la sede' }}</h2>
        <InsigniaFz v-if="insignia" :variante="insignia.variante">{{ insignia.texto }}</InsigniaFz>
        <span v-if="cargando" class="tarjeta__actualizando" aria-live="polite">Actualizando…</span>
      </div>

      <slot name="selector" />
    </div>

    <template v-if="aforo">
      <MedidorFz :valor="aforo.aforoActual" :maximo="aforo.aforoMaximo" :nivel="nivelBarra" etiqueta="Nivel de ocupación" />

      <dl class="indicadores">
        <div class="indicador">
          <dt class="indicador__etiqueta">Ocupación actual</dt>
          <dd :class="['indicador__valor', `indicador__valor--${tonoOcupacion}`]">{{ aforo.aforoActual }}</dd>
        </div>
        <div class="indicador">
          <dt class="indicador__etiqueta">Lugares disponibles</dt>
          <dd :class="['indicador__valor', `indicador__valor--${tonoDisponibles}`]">{{ Math.max(0, aforo.restante) }}</dd>
        </div>
        <div class="indicador">
          <dt class="indicador__etiqueta">Capacidad máxima</dt>
          <dd class="indicador__valor">{{ aforo.aforoMaximo }}</dd>
        </div>
      </dl>

      <AvisoFz v-if="estaLleno" variante="advertencia">
        La sede alcanzó su capacidad máxima: los ingresos nuevos se rechazan hasta que alguien registre su egreso.
      </AvisoFz>
    </template>

    <p v-else-if="cargando" class="tarjeta__estado">Cargando el aforo…</p>
    <p v-else class="tarjeta__estado">Elegí una sede para ver su aforo.</p>
  </section>
</template>

<style scoped>
.tarjeta {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  padding: var(--fz-espaciado-amplio);
  border: 1px solid var(--fz-color-borde-marcado);
  border-radius: var(--fz-radio-control);
  background: var(--fz-color-fondo);
}

.tarjeta__cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.tarjeta__sede {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.tarjeta__nombre {
  margin: 0;
  color: var(--fz-color-texto);
  font-size: var(--fz-texto-subtitulo);
  font-weight: var(--fz-peso-enfasis);
}

.tarjeta__actualizando,
.tarjeta__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

/* Tres indicadores en una fila, separados por líneas finas (sin cajas de color). */
.indicadores {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin: 0;
  border-top: 1px solid var(--fz-color-borde);
}

.indicador {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-minimo);
  padding: var(--fz-espaciado-base) var(--fz-espaciado-base) 0;
}

.indicador + .indicador {
  border-left: 1px solid var(--fz-color-borde);
}

.indicador:first-child {
  padding-left: 0;
}

.indicador__etiqueta {
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-minimo);
}

.indicador__valor {
  margin: 0;
  color: var(--fz-color-texto);
  font-size: var(--fz-texto-titulo);
  font-weight: var(--fz-peso-enfasis);
  font-variant-numeric: tabular-nums;
}

.indicador__valor--advertencia {
  color: var(--fz-color-advertencia);
}

.indicador__valor--peligro {
  color: var(--fz-color-peligro);
}

@media (max-width: 40rem) {
  .indicadores {
    grid-template-columns: 1fr;
  }

  .indicador,
  .indicador:first-child {
    padding-left: 0;
  }

  .indicador + .indicador {
    border-top: 1px solid var(--fz-color-borde);
    border-left: none;
    margin-top: var(--fz-espaciado-base);
  }
}
</style>
