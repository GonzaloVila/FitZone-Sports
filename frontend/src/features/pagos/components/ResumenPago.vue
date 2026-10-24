<script setup lang="ts">
import type { ReservaCancha } from '@/features/canchas/services/servicioCanchas'
import { formatearMonto, rangoDeTurno } from '../presentacion'

defineProps<{ reserva: ReservaCancha | null }>()
</script>

<template>
  <section v-if="reserva" class="resumen" aria-labelledby="titulo-resumen">
    <h2 id="titulo-resumen" class="resumen__titulo">Resumen del cobro</h2>
    <dl class="resumen__lista">
      <div class="resumen__fila">
        <dt>Reserva</dt>
        <dd>#{{ reserva.id }} · Cancha #{{ reserva.canchaId }}</dd>
      </div>
      <div class="resumen__fila">
        <dt>Turno</dt>
        <dd>{{ rangoDeTurno(reserva.fechaHoraInicio, reserva.fechaHoraFin) }}</dd>
      </div>
      <div class="resumen__fila">
        <dt>Monto a pagar</dt>
        <dd class="resumen__monto">{{ formatearMonto(reserva.precioAplicado) }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.resumen {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: var(--fz-espaciado-base);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  background: var(--fz-color-superficie);
}

.resumen__titulo {
  margin: 0;
  font-size: 1.125rem;
  color: var(--fz-color-texto);
}

.resumen__lista {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
}

.resumen__fila {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
}

.resumen__fila dt {
  color: var(--fz-color-texto-suave);
}

.resumen__fila dd {
  margin: 0;
  color: var(--fz-color-texto);
}

.resumen__monto {
  font-weight: 700;
  font-size: 1.125rem;
}
</style>
