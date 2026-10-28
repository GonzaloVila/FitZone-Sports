<script setup lang="ts">
import { computed } from 'vue'
import { AvisoFz, BotonFz, IconoFz } from '@/ui'
import { useAvisoPenalidad } from '../composables/useAvisoPenalidad'
import type { Clase } from '../services/servicioClases'
import { textoAvisoPenalidad } from '../textosPenalidad'

// Con `clase` es el detalle de esa clase (con su hora actual en `ahora`); sin ella, la agenda.
const props = defineProps<{
  clase?: Clase | null
  ahora?: number
}>()

// La última penalidad cobrada: queda visible en la agenda y en el detalle de la clase cancelada hasta que se la cierra.
const { penalidad, cerrar, descargando, error, descargarComprobante } = useAvisoPenalidad()

const texto = computed(() => {
  if (!penalidad.value) return null
  const vista = props.clase ? { clase: props.clase, ahora: props.ahora ?? Date.now() } : null
  return textoAvisoPenalidad(penalidad.value, vista)
})
</script>

<template>
  <template v-if="texto">
    <AvisoFz variante="advertencia">
      <div class="aviso-penalidad">
        <p class="aviso-penalidad__texto">{{ texto }}</p>
        <div class="aviso-penalidad__acciones">
          <BotonFz variante="secundario" tamano="sm" :cargando="descargando" @click="descargarComprobante">
            Descargar comprobante
          </BotonFz>
          <BotonFz variante="fantasma" class="aviso-penalidad__cerrar" aria-label="Cerrar aviso" @click="cerrar">
            <IconoFz nombre="cerrar" tamano="sm" />
          </BotonFz>
        </div>
      </div>
    </AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
  </template>
</template>

<style scoped>
.aviso-penalidad {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.aviso-penalidad__texto {
  margin: 0;
}

.aviso-penalidad__acciones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

/* Botón de solo ícono: cuadrado, del alto de un botón mediano. */
.aviso-penalidad__acciones .aviso-penalidad__cerrar {
  min-width: var(--fz-boton-alto-md);
  padding: 0;
}
</style>
