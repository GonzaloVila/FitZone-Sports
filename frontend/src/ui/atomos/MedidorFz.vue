<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    valor: number
    maximo: number
    etiqueta?: string
    // Color del llenado, ya decidido por quien lo usa (el kit no conoce las reglas de cada dominio):
    // 'normal' verde, 'advertencia' ámbar, 'critico' rojo.
    nivel?: 'normal' | 'advertencia' | 'critico'
  }>(),
  {
    etiqueta: 'Ocupación',
    nivel: 'normal',
  },
)

const porcentaje = computed(() => {
  if (props.maximo <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((props.valor / props.maximo) * 100)))
})
</script>

<template>
  <div class="medidor-fz" :class="[`medidor-fz--${nivel}`]">
    <div class="medidor-fz__cabecera">
      <span class="medidor-fz__etiqueta">{{ etiqueta }}</span>
      <span class="medidor-fz__texto" aria-hidden="true">
        <strong>{{ valor }}</strong> de <strong>{{ maximo }}</strong> ({{ porcentaje }}%)
      </span>
    </div>

    <!-- Pista de la barra -->
    <div
      class="medidor-fz__pista"
      role="progressbar"
      :aria-label="etiqueta"
      :aria-valuenow="valor"
      :aria-valuemin="0"
      :aria-valuemax="maximo"
      :aria-valuetext="`${valor} de ${maximo} personas (${porcentaje}%)`"
    >
      <div
        class="medidor-fz__llenado"
        :style="{ width: `${porcentaje}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
.medidor-fz {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
  width: 100%;
}

.medidor-fz__cabecera {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto);
}

.medidor-fz__etiqueta {
  font-weight: var(--fz-peso-medio);
}

.medidor-fz__texto {
  font-variant-numeric: tabular-nums;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.medidor-fz__pista {
  width: 100%;
  height: 0.5rem;
  border-radius: var(--fz-radio-pildora);
  background: var(--fz-color-hover);
  overflow: hidden;
  border: 1px solid var(--fz-color-borde);
  position: relative;
}

.medidor-fz__llenado {
  height: 100%;
  border-radius: var(--fz-radio-pildora);
  transition: width 500ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms ease;
}

/* Colores dinámicos */
.medidor-fz--normal .medidor-fz__llenado {
  background: var(--fz-color-exito);
}

.medidor-fz--advertencia .medidor-fz__llenado {
  background: var(--fz-color-advertencia);
}

.medidor-fz--critico .medidor-fz__llenado {
  background: var(--fz-color-peligro);
}
</style>
