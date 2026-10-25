<script setup lang="ts">
import { AvatarFz, InsigniaFz } from '@/ui'
import { ETIQUETAS_ESTADO, ETIQUETAS_PLAN, VARIANTES_ESTADO, textoVigencia } from '../../presentacion'
import type { Membresia } from '../../services/servicioSocios'
import type { SocioResumen } from '../../tipos'

defineProps<{
  socio: SocioResumen
  membresia: Membresia | null
}>()
</script>

<template>
  <div class="resumen">
    <AvatarFz :nombre="socio.nombre" tamano="sm" />
    <div class="resumen__datos">
      <p class="resumen__nombre">{{ socio.nombre }}</p>
      <p class="resumen__detalle">{{ socio.email }} · #{{ socio.id }}</p>
      <div v-if="membresia" class="resumen__membresia">
        <InsigniaFz :variante="VARIANTES_ESTADO[membresia.estado]">{{ ETIQUETAS_ESTADO[membresia.estado] }}</InsigniaFz>
        <InsigniaFz>{{ ETIQUETAS_PLAN[membresia.plan] }}</InsigniaFz>
        <span class="resumen__vigencia">{{ textoVigencia(membresia) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resumen {
  display: flex;
  align-items: flex-start;
  gap: var(--fz-espaciado-compacto);
  padding: var(--fz-espaciado-compacto);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-control);
  background: var(--fz-color-superficie);
}

.resumen__datos {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
  min-width: 0;
}

.resumen__nombre,
.resumen__detalle {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resumen__nombre {
  font-weight: var(--fz-peso-enfasis);
}

.resumen__detalle,
.resumen__vigencia {
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-minimo);
}

.resumen__membresia {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}
</style>
