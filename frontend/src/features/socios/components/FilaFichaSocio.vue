<script setup lang="ts">
import { IconoFz, type NombreIconoFz } from '@/ui'

defineProps<{
  etiqueta: string
  icono: NombreIconoFz
}>()
</script>

<template>
  <div class="fila">
    <dt class="fila__etiqueta">
      <IconoFz :nombre="icono" tamano="sm" />
      {{ etiqueta }}
    </dt>
    <dd class="fila__valor"><slot /></dd>
  </div>
</template>

<style scoped>
.fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
  min-height: 2.5rem;
  padding: var(--fz-espaciado-compacto) 0;
  border-top: 1px solid var(--fz-color-borde);
}

.fila__etiqueta {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.fila__valor {
  min-width: 0;
  margin: 0;
  color: var(--fz-color-texto);
  font-size: var(--fz-texto-pequeno);
  text-align: right;
  overflow-wrap: anywhere;
}
</style>
