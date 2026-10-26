<script setup lang="ts">
import { computed } from 'vue'
import { AvisoFz, InsigniaFz, MedidorFz } from '@/ui'
import type { Aforo } from '../services/servicioAcceso'

const props = defineProps<{
  aforo: Aforo | null
  nombreSede?: string
  cargando?: boolean
}>()

const estaLleno = computed(() => {
  if (!props.aforo) return false
  return props.aforo.restante <= 0 || props.aforo.aforoActual >= props.aforo.aforoMaximo
})

const ocupacionPorcentaje = computed(() => {
  if (!props.aforo || props.aforo.aforoMaximo <= 0) return 0
  return Math.round((props.aforo.aforoActual / props.aforo.aforoMaximo) * 100)
})

const casiLleno = computed(() => !estaLleno.value && ocupacionPorcentaje.value >= 80)

// Estado de la sede para la insignia: Disponible, Casi lleno o Lleno.
const estado = computed(() => {
  if (estaLleno.value) return { texto: 'Lleno', variante: 'peligro' as const }
  if (casiLleno.value) return { texto: 'Casi lleno', variante: 'advertencia' as const }
  return { texto: 'Disponible', variante: 'exito' as const }
})

// Solo el número lleva color, y solo cuando el estado lo pide: los mismos umbrales que cambian el color de la barra
// (70 % ámbar, 90 % rojo).
const tonoOcupacion = computed(() =>
  ocupacionPorcentaje.value >= 90 ? 'peligro' : ocupacionPorcentaje.value >= 70 ? 'advertencia' : 'normal',
)
const tonoDisponibles = computed(() => (estaLleno.value ? 'peligro' : 'normal'))
</script>

<template>
  <section class="tarjeta" aria-label="Aforo de la sede">
    <div class="tarjeta__cabecera">
      <div class="tarjeta__sede">
        <h2 class="tarjeta__nombre">{{ nombreSede ?? 'Aforo de la sede' }}</h2>
        <InsigniaFz v-if="aforo" :variante="estado.variante">{{ estado.texto }}</InsigniaFz>
        <span v-if="cargando" class="tarjeta__actualizando" aria-live="polite">Actualizando…</span>
      </div>

      <slot name="selector" />
    </div>

    <template v-if="aforo">
      <MedidorFz :valor="aforo.aforoActual" :maximo="aforo.aforoMaximo" etiqueta="Nivel de ocupación" />

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
