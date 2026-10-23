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

const colorOcupacion = computed(() => {
  if (ocupacionPorcentaje.value >= 100) return 'peligro'
  if (ocupacionPorcentaje.value >= 80) return 'advertencia'
  return 'normal'
})
</script>

<template>
  <div class="tarjeta-aforo">
    <div class="tarjeta-aforo__cabecera">
      <div class="tarjeta-aforo__info-sede">
        <h3 class="tarjeta-aforo__titulo">
          {{ nombreSede ? nombreSede : 'Aforo de la sede' }}
        </h3>
        <InsigniaFz v-if="aforo" :variante="estaLleno ? 'peligro' : ocupacionPorcentaje >= 80 ? 'advertencia' : 'exito'">
          {{ estaLleno ? 'Lleno' : 'Disponible' }}
        </InsigniaFz>
      </div>

      <div class="tarjeta-aforo__acciones-cabecera">
        <!-- Slot para inyectar selector de sede o controles adicionales -->
        <slot name="selector" />
        <span v-if="cargando" class="tarjeta-aforo__actualizando" aria-live="polite">
          <span class="tarjeta-aforo__spinner" aria-hidden="true" />
          Actualizando…
        </span>
      </div>
    </div>

    <div v-if="aforo" class="tarjeta-aforo__cuerpo">
      <!-- Barra visual estilizada -->
      <MedidorFz
        :valor="aforo.aforoActual"
        :maximo="aforo.aforoMaximo"
        etiqueta="Nivel de ocupación"
      />

      <!-- KPI Cards destacadas -->
      <div class="tarjeta-aforo__kpis">
        <!-- KPI 1: Ocupación actual -->
        <div class="tarjeta-aforo__kpi" :class="[`tarjeta-aforo__kpi--${colorOcupacion}`]">
          <span class="tarjeta-aforo__kpi-etiqueta">Ocupación actual</span>
          <div class="tarjeta-aforo__kpi-valor-grupo">
            <span class="tarjeta-aforo__kpi-valor">{{ aforo.aforoActual }}</span>
            <span class="tarjeta-aforo__kpi-subtexto">personas</span>
          </div>
        </div>

        <!-- KPI 2: Lugares disponibles (Esmeralda destacado) -->
        <div class="tarjeta-aforo__kpi tarjeta-aforo__kpi--disponibles">
          <span class="tarjeta-aforo__kpi-etiqueta">Lugares disponibles</span>
          <div class="tarjeta-aforo__kpi-valor-grupo">
            <span class="tarjeta-aforo__kpi-valor">{{ Math.max(0, aforo.restante) }}</span>
            <span class="tarjeta-aforo__kpi-subtexto">restantes</span>
          </div>
        </div>

        <!-- KPI 3: Capacidad máxima (Neutro) -->
        <div class="tarjeta-aforo__kpi tarjeta-aforo__kpi--capacidad">
          <span class="tarjeta-aforo__kpi-etiqueta">Capacidad máxima</span>
          <div class="tarjeta-aforo__kpi-valor-grupo">
            <span class="tarjeta-aforo__kpi-valor">{{ aforo.aforoMaximo }}</span>
            <span class="tarjeta-aforo__kpi-subtexto">máximo permitido</span>
          </div>
        </div>
      </div>

      <AvisoFz v-if="estaLleno" variante="advertencia" class="tarjeta-aforo__aviso-lleno">
        <strong>⚠️ Aforo completo:</strong> La sede ha alcanzado su capacidad máxima permitida. Los nuevos ingresos serán rechazados por el sistema hasta registrar egresos.
      </AvisoFz>
    </div>

    <div v-else-if="cargando" class="tarjeta-aforo__vacio">
      Cargando información de aforo…
    </div>
    <div v-else class="tarjeta-aforo__vacio">
      Seleccione una sede para consultar el aforo.
    </div>
  </div>
</template>

<style scoped>
.tarjeta-aforo {
  background: var(--fz-color-superficie);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  padding: 1.5rem;
  box-shadow: var(--fz-sombra-tarjeta);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.tarjeta-aforo__cabecera {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.tarjeta-aforo__info-sede {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tarjeta-aforo__titulo {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--fz-color-texto);
  letter-spacing: -0.015em;
}

.tarjeta-aforo__acciones-cabecera {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.tarjeta-aforo__actualizando {
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.tarjeta-aforo__spinner {
  width: 0.75rem;
  height: 0.75rem;
  border: 2px solid var(--fz-color-borde);
  border-top-color: var(--fz-color-primario);
  border-radius: 50%;
  animation: girar 0.6s linear infinite;
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}

.tarjeta-aforo__cuerpo {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* KPI Cards */
.tarjeta-aforo__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.tarjeta-aforo__kpi {
  padding: 1rem;
  border-radius: var(--fz-radio-control);
  border: 1px solid var(--fz-color-borde);
  background: var(--fz-color-hover);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.tarjeta-aforo__kpi:hover {
  transform: translateY(-1px);
  box-shadow: var(--fz-sombra-tarjeta);
}

.tarjeta-aforo__kpi-etiqueta {
  font-size: 0.8125rem;
  color: var(--fz-color-texto-suave);
  font-weight: var(--fz-peso-medio, 500);
}

.tarjeta-aforo__kpi-valor-grupo {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
}

.tarjeta-aforo__kpi-valor {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--fz-color-texto);
}

.tarjeta-aforo__kpi-subtexto {
  font-size: 0.75rem;
  color: var(--fz-color-texto-suave);
}

/* Variantes KPI */
.tarjeta-aforo__kpi--normal .tarjeta-aforo__kpi-valor {
  color: var(--fz-color-texto);
}

.tarjeta-aforo__kpi--advertencia {
  border-color: var(--fz-color-advertencia-borde);
  background: var(--fz-color-advertencia-fondo);
}
.tarjeta-aforo__kpi--advertencia .tarjeta-aforo__kpi-valor {
  color: var(--fz-color-advertencia);
}

.tarjeta-aforo__kpi--critico {
  border-color: var(--fz-color-peligro-borde);
  background: var(--fz-color-peligro-fondo);
}
.tarjeta-aforo__kpi--critico .tarjeta-aforo__kpi-valor {
  color: var(--fz-color-peligro);
}

.tarjeta-aforo__kpi--disponibles {
  border-color: var(--fz-color-exito-borde);
  background: var(--fz-color-exito-fondo);
}
.tarjeta-aforo__kpi--disponibles .tarjeta-aforo__kpi-valor {
  color: var(--fz-color-exito);
}

.tarjeta-aforo__kpi--capacidad {
  background: var(--fz-color-hover);
}

.tarjeta-aforo__aviso-lleno {
  margin-top: 0.25rem;
}

.tarjeta-aforo__vacio {
  color: var(--fz-color-texto-suave);
  padding: 1.5rem 0;
  text-align: center;
}
</style>
