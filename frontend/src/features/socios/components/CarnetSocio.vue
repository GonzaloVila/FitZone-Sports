<script setup lang="ts">
import { InsigniaFz } from '@/ui'

// Presentacional: recibe los datos ya formateados. El QR, si lo hay, entra por el slot `qr`.
defineProps<{
  nombre: string
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
    <header class="carnet__encabezado">FitZone Sports</header>
    <div class="carnet__cuerpo">
      <dl class="carnet__datos">
        <div class="carnet__dato carnet__dato--nombre">
          <dt>Nombre</dt>
          <dd>{{ nombre }}</dd>
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
  max-width: 36rem;
  overflow: hidden;
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-tarjeta);
  background: var(--fz-color-fondo);
  box-shadow: var(--fz-sombra-suave);
}

.carnet__encabezado {
  padding: var(--fz-espaciado-compacto) var(--fz-espaciado-base);
  border-bottom: 1px solid var(--fz-color-borde);
  background: var(--fz-color-superficie);
  font-weight: var(--fz-peso-enfasis);
  color: var(--fz-color-texto);
}

.carnet__cuerpo {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fz-espaciado-amplio);
  padding: var(--fz-espaciado-base);
}

.carnet__datos {
  display: grid;
  flex: 1 1 14rem;
  gap: var(--fz-espaciado-compacto);
  margin: 0;
}

.carnet__dato {
  display: flex;
  flex-direction: column;
  font-size: var(--fz-texto-pequeno);
}

.carnet__dato dt {
  color: var(--fz-color-texto-suave);
}

.carnet__dato dd {
  margin: 0;
  color: var(--fz-color-texto);
}

.carnet__dato--nombre dd {
  font-size: var(--fz-texto-cuerpo);
  font-weight: var(--fz-peso-enfasis);
}

.carnet__qr {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: center;
}
</style>
