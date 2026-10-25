<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import IconoFz from '../atomos/IconoFz.vue'
import type { NombreIconoFz } from '../atomos/IconoFz.vue'

export interface AccionMenuFz {
  clave: string
  etiqueta: string
  icono?: NombreIconoFz
  deshabilitada?: boolean
  peligro?: boolean
}

defineProps<{
  // Texto accesible del disparador (que solo tiene un ícono), ej. "Acciones de Camila Domínguez".
  etiqueta: string
  acciones: AccionMenuFz[]
}>()

const emit = defineEmits<{
  seleccionar: [clave: string]
}>()
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="menu-acciones__disparador" :aria-label="etiqueta">
      <IconoFz nombre="acciones" tamano="sm" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="menu-acciones__contenido" align="end" :side-offset="4" :collision-padding="8">
        <DropdownMenuItem
          v-for="accion in acciones"
          :key="accion.clave"
          :class="['menu-acciones__item', { 'menu-acciones__item--peligro': accion.peligro }]"
          :disabled="accion.deshabilitada"
          :text-value="accion.etiqueta"
          @select="emit('seleccionar', accion.clave)"
        >
          <IconoFz v-if="accion.icono" :nombre="accion.icono" tamano="sm" />
          <span>{{ accion.etiqueta }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style>
/*
 * Sin scoped a propósito: Reka dibuja un envoltorio propio (el del Popper, alrededor del contenido del menú) que recibe el atributo data-v del
 * componente, y nuestra clase cae en el elemento interno, que no lo recibe. Con scoped esos estilos no se
 * aplican. Las clases llevan el prefijo del componente para que no se crucen con otras.
 */
.menu-acciones__disparador {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--fz-menu-acciones-disparador-alto);
  min-height: var(--fz-menu-acciones-disparador-alto);
  padding: 0;
  border: none;
  border-radius: var(--fz-menu-acciones-disparador-radio);
  background: transparent;
  color: var(--fz-menu-acciones-disparador-color);
  font-family: inherit;
  cursor: pointer;
}

.menu-acciones__disparador:hover,
.menu-acciones__disparador[data-state='open'] {
  background: var(--fz-menu-acciones-disparador-fondo-hover);
}

.menu-acciones__disparador:focus-visible {
  outline: var(--fz-menu-acciones-foco-ancho) solid var(--fz-menu-acciones-foco-color);
  outline-offset: var(--fz-menu-acciones-foco-separacion);
}

.menu-acciones__contenido {
  z-index: var(--fz-menu-acciones-capa);
  min-width: var(--fz-menu-acciones-ancho-min);
  padding: var(--fz-menu-acciones-relleno);
  border: var(--fz-menu-acciones-borde-ancho) solid var(--fz-menu-acciones-borde);
  border-radius: var(--fz-menu-acciones-radio);
  background: var(--fz-menu-acciones-fondo);
  box-shadow: var(--fz-menu-acciones-sombra);
  animation: menu-acciones-entrada var(--fz-menu-acciones-animacion-duracion) ease-out;
}

.menu-acciones__item {
  display: flex;
  align-items: center;
  gap: var(--fz-menu-acciones-item-separacion);
  min-height: var(--fz-menu-acciones-item-alto);
  padding: 0 var(--fz-menu-acciones-item-relleno-x);
  border-radius: var(--fz-menu-acciones-item-radio);
  color: var(--fz-menu-acciones-item-color);
  font-size: var(--fz-menu-acciones-item-texto);
  cursor: pointer;
  user-select: none;
}

/* Reka marca con data-highlighted el ítem activo por teclado o puntero. */
.menu-acciones__item[data-highlighted] {
  background: var(--fz-menu-acciones-item-fondo-resaltado);
}

/*
 * El fondo de resaltado solo no alcanza como indicador de foco (WCAG 1.4.11, 3:1): con el teclado el ítem
 * suma un anillo. Offset negativo: queda dentro del menú y no lo recorta el borde.
 */
.menu-acciones__item:focus-visible {
  outline: var(--fz-menu-acciones-foco-ancho) solid var(--fz-menu-acciones-foco-color);
  outline-offset: calc(-1 * var(--fz-menu-acciones-foco-ancho));
}

.menu-acciones__item:focus:not(:focus-visible) {
  outline: none;
}

.menu-acciones__item--peligro {
  color: var(--fz-menu-acciones-item-peligro-color);
}

.menu-acciones__item[data-disabled] {
  color: var(--fz-menu-acciones-item-deshabilitado-color);
  opacity: var(--fz-menu-acciones-item-deshabilitado-opacidad);
  cursor: not-allowed;
}

@keyframes menu-acciones-entrada {
  from {
    opacity: 0;
    transform: translateY(calc(-1 * var(--fz-menu-acciones-animacion-desplazamiento)));
  }
}

@media (prefers-reduced-motion: reduce) {
  .menu-acciones__contenido {
    animation: none;
  }
}
</style>
