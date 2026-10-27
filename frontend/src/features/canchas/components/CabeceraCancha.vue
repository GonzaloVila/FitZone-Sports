<script setup lang="ts">
import { InsigniaFz } from '@/ui'
import { ETIQUETA_ESTADO_CANCHA, ETIQUETA_TIPO_CANCHA, formatearMonto } from '../presentacion'
import type { Cancha } from '../services/servicioCanchas'

defineProps<{
  cancha: Cancha
  nombreSede: string
}>()
</script>

<template>
  <dl class="cabecera" aria-label="Datos de la cancha">
    <div class="cabecera__dato">
      <dt class="cabecera__etiqueta">Deporte</dt>
      <dd class="cabecera__valor">{{ ETIQUETA_TIPO_CANCHA[cancha.tipo] }} #{{ cancha.id }}</dd>
    </div>
    <div class="cabecera__dato">
      <dt class="cabecera__etiqueta">Sede</dt>
      <dd class="cabecera__valor">{{ nombreSede }}</dd>
    </div>
    <div class="cabecera__dato">
      <dt class="cabecera__etiqueta">Precio base por hora</dt>
      <dd class="cabecera__valor">{{ formatearMonto(cancha.costoPorHora) }}</dd>
    </div>
    <div class="cabecera__dato">
      <dt class="cabecera__etiqueta">Estado</dt>
      <dd class="cabecera__valor">
        <InsigniaFz :variante="cancha.estado === 'OPERATIVA' ? 'exito' : 'advertencia'">
          {{ ETIQUETA_ESTADO_CANCHA[cancha.estado] }}
        </InsigniaFz>
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.cabecera {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fz-espaciado-base) var(--fz-espaciado-amplio);
  margin: 0;
}

.cabecera__dato {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-minimo);
}

.cabecera__etiqueta {
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.cabecera__valor {
  margin: 0;
  font-size: var(--fz-texto-cuerpo);
  font-weight: var(--fz-peso-enfasis);
}
</style>
