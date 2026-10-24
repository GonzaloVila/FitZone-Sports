<script setup lang="ts">
import { reactive, watch } from 'vue'
import {
  AvisoFz,
  BotonFz,
  CampoTextoFz,
  InsigniaFz,
  SelectFz,
  TablaFz,
  type ColumnaTabla,
} from '@/ui'
import FormularioCancha from '../components/FormularioCancha.vue'
import { useGestionCanchas } from '../composables/useGestionCanchas'
import { ETIQUETA_ESTADO_CANCHA, ETIQUETA_TIPO_CANCHA, formatearMonto } from '../presentacion'
import type { Cancha } from '../services/servicioCanchas'

const {
  sedes,
  cargandoSedes,
  errorSedes,
  sede,
  items,
  cargando,
  error,
  guardando,
  errorFormulario,
  exito,
  nuevo,
  crear,
  alternarMantenimiento,
  cambiarCosto,
} = useGestionCanchas()

const COLUMNAS: ColumnaTabla[] = [
  { clave: 'tipo', etiqueta: 'Deporte' },
  { clave: 'estado', etiqueta: 'Estado' },
  { clave: 'costo', etiqueta: 'Costo por hora' },
  { clave: 'acciones', etiqueta: 'Acciones' },
]

const costos = reactive<Record<number, string>>({})

watch(
  items,
  (lista) => {
    const ids = new Set(lista.map((cancha) => cancha.id))
    for (const clave of Object.keys(costos)) {
      if (!ids.has(Number(clave))) delete costos[Number(clave)]
    }
    for (const cancha of lista) {
      if (costos[cancha.id] === undefined) costos[cancha.id] = String(cancha.costoPorHora)
    }
  },
  { immediate: true },
)

function cambioDeCosto(cancha: Cancha): boolean {
  return Number(costos[cancha.id]) !== cancha.costoPorHora
}

function guardarCosto(cancha: Cancha) {
  void cambiarCosto(cancha, Number(costos[cancha.id]))
}
</script>

<template>
  <section class="gestion">
    <header class="gestion__encabezado">
      <h1 class="gestion__titulo">Gestión de canchas</h1>
      <p class="gestion__subtitulo">Alta, costo por hora y mantenimiento de las canchas de una sede.</p>
    </header>

    <label class="gestion__campo">
      <span class="gestion__etiqueta">Sede</span>
      <SelectFz v-model="sede" :disabled="cargandoSedes">
        <option value="">Elegí una sede</option>
        <option v-for="opcion in sedes" :key="opcion.id" :value="String(opcion.id)">
          {{ opcion.nombre }}
        </option>
      </SelectFz>
    </label>

    <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <AvisoFz v-if="exito" variante="exito">{{ exito }}</AvisoFz>

    <FormularioCancha
      v-if="sede"
      v-model:tipo="nuevo.tipo"
      v-model:costo-por-hora="nuevo.costoPorHora"
      :guardando="guardando"
      :error="errorFormulario"
      @crear="crear"
    />

    <p v-if="cargando" class="gestion__estado" role="status">Cargando canchas…</p>

    <TablaFz
      v-else-if="items.length > 0"
      titulo="Canchas de la sede"
      :columnas="COLUMNAS"
      :filas="items"
      :clave-fila="(cancha) => cancha.id"
      :ocupada="guardando"
      ocultar-titulo
    >
      <template #celda-tipo="{ fila }">
        {{ ETIQUETA_TIPO_CANCHA[fila.tipo] }} <span class="gestion__id">#{{ fila.id }}</span>
      </template>
      <template #celda-estado="{ fila }">
        <InsigniaFz :variante="fila.estado === 'OPERATIVA' ? 'exito' : 'advertencia'">
          {{ ETIQUETA_ESTADO_CANCHA[fila.estado] }}
        </InsigniaFz>
      </template>
      <template #celda-costo="{ fila }">
        <div class="gestion__costo">
          <CampoTextoFz v-model="costos[fila.id]" tipo="number" min="0" step="0.01" tamano="sm" />
          <BotonFz
            v-if="cambioDeCosto(fila)"
            tamano="sm"
            :disabled="guardando"
            @click="guardarCosto(fila)"
          >
            Guardar
          </BotonFz>
          <span v-else class="gestion__costo-actual">{{ formatearMonto(fila.costoPorHora) }}</span>
        </div>
      </template>
      <template #celda-acciones="{ fila }">
        <BotonFz
          tamano="sm"
          :variante="fila.estado === 'OPERATIVA' ? 'secundario' : 'primario'"
          :disabled="guardando"
          @click="alternarMantenimiento(fila)"
        >
          {{ fila.estado === 'OPERATIVA' ? 'Pasar a mantenimiento' : 'Liberar mantenimiento' }}
        </BotonFz>
      </template>
    </TablaFz>

    <p v-else-if="sede" class="gestion__vacio">La sede elegida todavía no tiene canchas.</p>
    <p v-else class="gestion__vacio">Elegí una sede para gestionar sus canchas.</p>
  </section>
</template>

<style scoped>
.gestion {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 64rem;
  margin: 0 auto;
  width: 100%;
}

.gestion__encabezado {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.gestion__titulo {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fz-color-texto);
}

.gestion__subtitulo {
  margin: 0;
  font-size: 0.875rem;
  color: var(--fz-color-texto-suave);
}

.gestion__campo {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-width: 14rem;
}

.gestion__etiqueta {
  font-size: var(--fz-texto-pequeno);
  font-weight: 600;
  color: var(--fz-color-texto);
}

.gestion__estado,
.gestion__vacio {
  margin: 0;
  color: var(--fz-color-texto-suave);
}

.gestion__id {
  color: var(--fz-color-texto-suave);
  font-weight: 400;
}

.gestion__costo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 12rem;
}

.gestion__costo-actual {
  font-size: var(--fz-texto-pequeno);
  color: var(--fz-color-texto-suave);
}
</style>
