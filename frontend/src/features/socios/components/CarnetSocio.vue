<script setup lang="ts">
import { InsigniaFz } from '@/ui'

// Presentacional: recibe los datos ya formateados. El QR, si lo hay, entra por el slot `qr`.
defineProps<{
  nombre: string
  socioId?: number | null
  dni?: string
  plan?: string
  estado?: { etiqueta: string; variante: 'exito' | 'peligro' | 'advertencia' }
  vigencia?: string
  sede?: string
}>()

const NO_DISPONIBLE = 'No disponible'
</script>

<template>
  <article class="carnet" aria-label="Carnet del socio">
    <header class="carnet__encabezado">
      <span>FitZone Sports</span>
      <span v-if="socioId" class="carnet__id-tag">ID #{{ socioId }}</span>
    </header>
    <div class="carnet__cuerpo">
      <dl class="carnet__datos">
        <div class="carnet__dato carnet__dato--nombre">
          <dt>Nombre</dt>
          <dd>{{ nombre }}</dd>
        </div>
        <div v-if="socioId" class="carnet__dato">
          <dt>ID Socio</dt>
          <dd><strong>{{ socioId }}</strong></dd>
        </div>
        <div class="carnet__dato">
          <dt>DNI</dt>
          <dd>{{ dni ?? NO_DISPONIBLE }}</dd>
        </div>
        <div class="carnet__dato">
          <dt>Plan</dt>
          <dd>{{ plan ?? NO_DISPONIBLE }}</dd>
        </div>
        <div class="carnet__dato">
          <dt>Estado</dt>
          <dd>
            <InsigniaFz v-if="estado" :variante="estado.variante">{{ estado.etiqueta }}</InsigniaFz>
            <template v-else>{{ NO_DISPONIBLE }}</template>
          </dd>
        </div>
        <div class="carnet__dato">
          <dt>Vigencia</dt>
          <dd>{{ vigencia ?? NO_DISPONIBLE }}</dd>
        </div>
        <div class="carnet__dato">
          <dt>Sede</dt>
          <dd>{{ sede ?? NO_DISPONIBLE }}</dd>
        </div>
      </dl>
      <div v-if="$slots.qr" class="carnet__qr"><slot name="qr" /></div>
    </div>
  </article>
</template>

<style scoped>
.carnet {
  max-width: 28rem;
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  background: var(--fz-color-superficie);
  box-shadow: var(--fz-sombra-tarjeta);
  overflow: hidden;
}

.carnet__encabezado {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--fz-color-primario);
  color: var(--fz-color-texto-sobre-primario);
  font-weight: 700;
  font-size: 0.875rem;
}

.carnet__id-tag {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.125rem 0.5rem;
  border-radius: var(--fz-radio-control);
  font-size: 0.75rem;
}

.carnet__cuerpo {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
}

.carnet__datos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1rem;
  margin: 0;
}

.carnet__dato {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.carnet__dato--nombre {
  grid-column: 1 / -1;
}

.carnet__dato dt {
  font-size: 0.75rem;
  color: var(--fz-color-texto-suave);
}

.carnet__dato dd {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fz-color-texto);
}

.carnet__qr {
  display: flex;
  justify-content: center;
  padding: 1rem 0 0.5rem;
  border-top: 1px dashed var(--fz-color-borde);
}
</style>
