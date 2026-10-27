<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSedeActiva } from '@/compartido/composables/useSedeActiva'
import { useSedes } from '@/features/sedes/composables/useSedes'
import { AvisoFz, BotonFz, EncabezadoPaginaFz, IconoFz, SelectFz } from '@/ui'
import ModalNuevaCancha from '../components/modales/ModalNuevaCancha.vue'
import TablaGestionCanchas from '../components/TablaGestionCanchas.vue'
import { useGestionCanchas } from '../composables/useGestionCanchas'
import type { Cancha } from '../services/servicioCanchas'

const { sedes, cargando: cargandoSedes, error: errorSedes } = useSedes()

// La sede que se gestiona es la sede activa, compartida con las otras pantallas de trabajo (solo el GERENTE llega acá).
const sedeActiva = useSedeActiva(sedes)
const sede = computed({
  get: () => (sedeActiva.value === null ? '' : String(sedeActiva.value)),
  set: (valor: string) => {
    sedeActiva.value = valor ? Number(valor) : null
  },
})

const { items, cargando, error, guardando, errorAccion, exito, alternarMantenimiento, cambiarCosto, recargar } =
  useGestionCanchas(sedeActiva)

const altaAbierta = ref(false)

// Una cancha nueva en otra sede lleva a mirar esa sede (el cambio de sede ya vuelve a consultar); en la misma, se recarga.
function alCrear(cancha: Cancha) {
  if (sedeActiva.value === cancha.sedeId) void recargar()
  else sedeActiva.value = cancha.sedeId
}
</script>

<template>
  <section class="gestion">
    <EncabezadoPaginaFz
      titulo="Gestión de canchas"
      subtitulo="Costo por hora y mantenimiento de las canchas de una sede."
      :volver="{ texto: 'Volver a canchas', a: { name: 'canchas' } }"
    >
      <template #acciones>
        <BotonFz @click="altaAbierta = true">
          <IconoFz nombre="mas" tamano="sm" />
          Nueva cancha
        </BotonFz>
      </template>
    </EncabezadoPaginaFz>

    <div class="filtros" role="group" aria-label="Sede de las canchas">
      <div class="filtros__select">
        <SelectFz v-model="sede" name="sede" aria-label="Sede" :disabled="cargandoSedes">
          <option value="" disabled>{{ cargandoSedes ? 'Cargando sedes…' : 'Elegí una sede' }}</option>
          <option v-for="opcion in sedes" :key="opcion.id" :value="String(opcion.id)">{{ opcion.nombre }}</option>
        </SelectFz>
      </div>
    </div>

    <AvisoFz v-if="errorSedes" variante="advertencia">{{ errorSedes }}</AvisoFz>
    <AvisoFz v-if="error" variante="peligro">{{ error }}</AvisoFz>
    <AvisoFz v-if="errorAccion" variante="peligro">{{ errorAccion }}</AvisoFz>
    <AvisoFz v-if="exito" variante="exito">{{ exito }}</AvisoFz>

    <TablaGestionCanchas
      v-if="items.length > 0"
      :canchas="items"
      :guardando="guardando"
      @mantenimiento="alternarMantenimiento"
      @costo="cambiarCosto"
    />

    <p v-else-if="cargando" class="gestion__estado" role="status">Cargando canchas…</p>

    <p v-else-if="!error" class="gestion__estado gestion__vacio" role="status">
      {{ sede ? 'La sede elegida todavía no tiene canchas.' : 'Elegí una sede para gestionar sus canchas.' }}
    </p>

    <ModalNuevaCancha v-model:abierto="altaAbierta" :sedes="sedes" :sede-inicial="sedeActiva" @creada="alCrear" />
  </section>
</template>

<style scoped>
.gestion {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  width: 100%;
}

.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
}

/* El select mide lo que su contenido. */
.filtros__select {
  flex: none;
  width: max-content;
  max-width: 100%;
}

.gestion__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.gestion__vacio {
  padding: var(--fz-espaciado-amplio) 0;
}
</style>
