<script setup lang="ts">
import { BotonFz, CampoTextoFz, IconoFz, SelectFz } from '@/ui'
import { ESTADOS_FILTRO, ETIQUETA_FILTRO_ESTADO, ETIQUETA_TIPO_CONCEPTO, TIPOS_CONCEPTO } from '../presentacion'

withDefaults(
  defineProps<{
    // Si hay algún filtro aplicado: muestra "Limpiar". Quién limpia es el padre (evento `limpiar`).
    hayFiltrosActivos: boolean
    // El campo "ID de usuario" no va en "Mis pagos" (la lista ya es de un solo usuario).
    mostrarUsuario?: boolean
  }>(),
  { mostrarUsuario: true },
)

const emit = defineEmits<{ limpiar: [] }>()

const usuarioId = defineModel<string>('usuarioId', { required: true })
const estado = defineModel<string>('estado', { required: true })
const tipo = defineModel<string>('tipo', { required: true })
const desde = defineModel<string>('desde', { required: true })
const hasta = defineModel<string>('hasta', { required: true })
</script>

<template>
  <div class="filtros" role="search" aria-label="Filtros de pagos">
    <div v-if="mostrarUsuario" class="filtros__ajustado filtros__usuario">
      <CampoTextoFz
        v-model="usuarioId"
        tipo="number"
        icono="buscar"
        name="usuarioId"
        min="1"
        placeholder="Buscar por ID de usuario"
        aria-label="ID de usuario"
      />
    </div>

    <div class="filtros__ajustado">
      <SelectFz v-model="tipo" name="tipo" aria-label="Concepto">
        <option value="">Todos los conceptos</option>
        <option v-for="valor in TIPOS_CONCEPTO" :key="valor" :value="valor">{{ ETIQUETA_TIPO_CONCEPTO[valor] }}</option>
      </SelectFz>
    </div>

    <div class="filtros__ajustado">
      <SelectFz v-model="estado" name="estado" aria-label="Estado del pago">
        <option v-for="valor in ESTADOS_FILTRO" :key="valor" :value="valor">{{ ETIQUETA_FILTRO_ESTADO[valor] }}</option>
      </SelectFz>
    </div>

    <!-- Las fechas mantienen su etiqueta visible: un campo de fecha vacío no dice por sí solo para qué sirve. -->
    <div class="filtros__ajustado filtros__fecha">
      <label for="filtro-pagos-desde" class="filtros__etiqueta">Desde</label>
      <CampoTextoFz id="filtro-pagos-desde" v-model="desde" tipo="date" name="desde" />
    </div>

    <div class="filtros__ajustado filtros__fecha">
      <label for="filtro-pagos-hasta" class="filtros__etiqueta">Hasta</label>
      <CampoTextoFz id="filtro-pagos-hasta" v-model="hasta" tipo="date" name="hasta" />
    </div>

    <BotonFz v-if="hayFiltrosActivos" variante="fantasma" @click="emit('limpiar')">
      <IconoFz nombre="cerrar" tamano="sm" />
      Limpiar
    </BotonFz>
  </div>
</template>

<style scoped>
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

/* Los controles miden lo que su contenido. */
.filtros__ajustado {
  flex: none;
  width: max-content;
  max-width: 100%;
}

/* El campo de ID entra con su texto de ayuda completo. */
.filtros__usuario {
  width: calc(15 * var(--fz-espaciado-base));
}

.filtros__fecha {
  display: flex;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.filtros__etiqueta {
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
