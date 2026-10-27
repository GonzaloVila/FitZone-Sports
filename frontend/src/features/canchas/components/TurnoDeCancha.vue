<script setup lang="ts">
import { computed } from 'vue'
import { BotonFz, IconoFz, InsigniaFz, type NombreIconoFz } from '@/ui'
import { rangoDeTurno, type EstadoTurno } from '../presentacion'
import { ETIQUETA_ESTADO_TURNO, type TurnoConEstado } from '../turnos'

const props = defineProps<{
  item: TurnoConEstado
  // Quien reserva (SOCIO, EXTERNO) ve cada turno como un botón; RECEPCION y GERENTE lo ven solo como información.
  reservable: boolean
}>()

const emit = defineEmits<{ elegir: [] }>()

// El estado siempre se dice con texto y con un ícono, no solo con el color.
const ICONO: Record<EstadoTurno, NombreIconoFz> = {
  libre: 'tilde',
  ocupado: 'cerrar',
  mantenimiento: 'pausa',
  pasado: 'reloj',
}

const VARIANTE: Record<EstadoTurno, 'exito' | 'peligro' | 'advertencia' | 'neutra'> = {
  libre: 'exito',
  ocupado: 'peligro',
  mantenimiento: 'advertencia',
  pasado: 'neutra',
}

const rango = computed(() => rangoDeTurno(props.item.turno.fechaHoraInicio, props.item.turno.fechaHoraFin))
const estado = computed(() => ETIQUETA_ESTADO_TURNO[props.item.estado])
const libre = computed(() => props.item.estado === 'libre')

// El contrato no trae un precio por turno (el final lo calcula el sistema al reservar), así que el nombre accesible dice la
// hora y el estado, y si se puede reservar.
const nombreAccesible = computed(() =>
  props.reservable && libre.value ? `${rango.value}, ${estado.value}. Reservar este turno` : `${rango.value}, ${estado.value}`,
)

function elegir() {
  if (libre.value) emit('elegir')
}
</script>

<template>
  <li class="turno">
    <!-- Un turno que no se puede reservar sigue siendo alcanzable con Tab (aria-disabled, no disabled) para poder escucharlo. -->
    <BotonFz
      v-if="reservable"
      :variante="libre ? 'secundario' : 'fantasma'"
      :class="['turno__boton', { 'turno__boton--inactivo': !libre }]"
      :aria-label="nombreAccesible"
      :aria-disabled="libre ? undefined : 'true'"
      @click="elegir"
    >
      <span class="turno__contenido">
        <span class="turno__hora">{{ rango }}</span>
        <span class="turno__estado"><IconoFz :nombre="ICONO[item.estado]" tamano="sm" />{{ estado }}</span>
      </span>
    </BotonFz>

    <div v-else class="turno__info" role="group" :aria-label="nombreAccesible">
      <span class="turno__hora">{{ rango }}</span>
      <InsigniaFz :variante="VARIANTE[item.estado]"><IconoFz :nombre="ICONO[item.estado]" tamano="sm" />{{ estado }}</InsigniaFz>
    </div>
  </li>
</template>

<style scoped>
.turno {
  display: flex;
  min-width: 0;
}

.turno__boton {
  flex: 1;
}

/* Un turno que no se reserva no cambia de aspecto al pasar el mouse ni parece clickeable. */
.turno .turno__boton.turno__boton--inactivo,
.turno .turno__boton.turno__boton--inactivo:hover {
  background: transparent;
  color: var(--fz-color-texto-suave);
  cursor: default;
}

.turno__contenido {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--fz-espaciado-minimo);
  padding: var(--fz-espaciado-compacto) 0;
}

.turno__hora {
  font-weight: var(--fz-peso-enfasis);
}

.turno__estado {
  display: inline-flex;
  align-items: center;
  gap: var(--fz-espaciado-minimo);
  font-size: var(--fz-texto-pequeno);
  font-weight: var(--fz-peso-normal);
}

.turno__info {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: var(--fz-espaciado-minimo);
  padding: var(--fz-espaciado-compacto);
}
</style>
