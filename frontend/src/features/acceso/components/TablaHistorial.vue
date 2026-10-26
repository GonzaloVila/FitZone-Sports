<script setup lang="ts">
import { computed } from 'vue'
import { AvatarFz, InsigniaFz, PaginacionFz, TablaFz, type ColumnaTabla } from '@/ui'
import type { Ingreso } from '../services/servicioAcceso'

const props = defineProps<{
  items: Ingreso[]
  total: number
  totalPaginas: number
  porPagina: number
  cargando: boolean
  nombreDeSede: (sedeId: number) => string
}>()

const pagina = defineModel<number>('pagina', { required: true })

const columnas: ColumnaTabla[] = [
  { clave: 'socio', etiqueta: 'Socio', encabezadoFila: true },
  { clave: 'dni', etiqueta: 'DNI', ajustada: true },
  { clave: 'sede', etiqueta: 'Sede', ajustada: true },
  { clave: 'ingreso', etiqueta: 'Ingreso', ajustada: true },
  { clave: 'egreso', etiqueta: 'Egreso', ajustada: true },
  { clave: 'estado', etiqueta: 'Estado', ajustada: true },
]

const claveFila = (fila: Ingreso) => fila.id

function formatearFechaHora(iso: string | null | undefined) {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return `${fecha.toLocaleDateString('es-AR')} ${fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
}

const hayFilas = computed(() => props.items.length > 0)
const cargandoSinFilas = computed(() => props.cargando && !hayFilas.value)

// La región del pie siempre está en el DOM (los lectores de pantalla solo anuncian cambios de una región existente);
// mientras no hay un resultado que informar, queda vacía.
const textoRango = computed(() => {
  if (cargandoSinFilas.value) return ''
  if (props.total === 0) return '0 registros'
  const inicio = (pagina.value - 1) * props.porPagina + 1
  const fin = Math.min(props.total, pagina.value * props.porPagina)
  return `Mostrando ${inicio} a ${fin} de ${props.total} ${props.total === 1 ? 'registro' : 'registros'}`
})
</script>

<template>
  <div class="historial">
    <TablaFz
      v-if="hayFilas"
      titulo="Historial de accesos"
      ocultar-titulo
      :columnas="columnas"
      :filas="items"
      :clave-fila="claveFila"
      :ocupada="cargando"
    >
      <template #celda-socio="{ fila }">
        <div class="socio">
          <AvatarFz :nombre="(fila as Ingreso).nombre" />
          <div class="socio__datos">
            <span class="socio__nombre">{{ (fila as Ingreso).nombre }}</span>
            <span class="socio__id" title="ID de socio">#{{ (fila as Ingreso).socioId }}</span>
          </div>
        </div>
      </template>

      <template #celda-dni="{ fila }">{{ (fila as Ingreso).dni }}</template>

      <template #celda-sede="{ fila }">{{ nombreDeSede((fila as Ingreso).sedeId) }}</template>

      <template #celda-ingreso="{ fila }">
        <span class="tenue">{{ formatearFechaHora((fila as Ingreso).fechaHoraIngreso) }}</span>
      </template>

      <template #celda-egreso="{ fila }">
        <span class="tenue">{{ formatearFechaHora((fila as Ingreso).fechaHoraEgreso) }}</span>
      </template>

      <template #celda-estado="{ fila }">
        <InsigniaFz v-if="!(fila as Ingreso).fechaHoraEgreso" variante="exito">En la sede</InsigniaFz>
        <InsigniaFz v-else>Egresado</InsigniaFz>
      </template>
    </TablaFz>

    <p v-else-if="cargandoSinFilas" class="estado" role="status">Cargando historial…</p>

    <p v-else class="estado estado--vacio">No hay registros de accesos con los filtros elegidos.</p>

    <footer class="pie">
      <p class="rango" role="status" aria-live="polite" aria-atomic="true">{{ textoRango }}</p>
      <PaginacionFz v-if="totalPaginas > 1" v-model="pagina" :total-paginas="totalPaginas" etiqueta="Paginación del historial" />
    </footer>
  </div>
</template>

<style scoped>
.historial {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.socio {
  display: flex;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

.socio__datos {
  display: flex;
  align-items: baseline;
  gap: var(--fz-espaciado-compacto);
  min-width: 0;
}

.socio__nombre {
  color: var(--fz-color-texto);
  font-weight: var(--fz-peso-enfasis);
}

.socio__id,
.tenue {
  color: var(--fz-color-texto-suave);
}

.socio__id {
  font-size: var(--fz-texto-minimo);
  font-weight: var(--fz-peso-normal);
}

.estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.estado--vacio {
  padding: var(--fz-espaciado-amplio) 0;
}

.pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-base);
}

.rango {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}
</style>
