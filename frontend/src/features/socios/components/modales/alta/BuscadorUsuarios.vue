<script setup lang="ts">
import { computed } from 'vue'
import type { Usuario } from '@/features/usuarios/services/servicioUsuarios'
import { AvisoFz, BotonFz, CampoFormularioFz, OpcionesTarjetaFz, type OpcionTarjetaFz } from '@/ui'
import type { AltaSocio } from '../../../composables/useAltaSocio'

const props = defineProps<{ alta: AltaSocio }>()

const opciones = computed<OpcionTarjetaFz[]>(() =>
  props.alta.resultados.map((usuario) => ({ valor: String(usuario.id), titulo: usuario.nombre, descripcion: usuario.email })),
)

// Texto de estado de la búsqueda; la región es en vivo, así que se anuncia sola.
const mensaje = computed(() => {
  const { buscando, errorBusqueda, busquedaHecha, resultados } = props.alta
  if (buscando) return 'Buscando…'
  if (errorBusqueda) return ''
  if (busquedaHecha && resultados.length === 0) return 'No se encontraron usuarios externos ni ex socios con esa búsqueda.'
  if (busquedaHecha) return `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}`
  return ''
})

function elegir(valor: string) {
  const usuario: Usuario | undefined = props.alta.resultados.find((candidato) => String(candidato.id) === valor)
  if (usuario) props.alta.seleccionar(usuario)
}
</script>

<template>
  <div class="buscador">
    <div v-if="alta.seleccionado" class="buscador__elegido">
      <p class="buscador__texto">
        <strong>{{ alta.seleccionado.nombre }}</strong>
        <span class="buscador__correo">{{ alta.seleccionado.email }}</span>
        <span v-if="alta.creadoAhora" class="buscador__correo">Usuario creado recién.</span>
      </p>
      <BotonFz variante="secundario" tamano="sm" data-primer-campo :disabled="alta.enviando" @click="alta.quitarSeleccion">
        Elegir otro
      </BotonFz>
    </div>

    <template v-else>
      <CampoFormularioFz
        v-model="alta.busqueda"
        etiqueta="Buscar por nombre o correo"
        etiqueta-chica
        ayuda="Usuarios externos y ex socios que todavía no tienen membresía."
        icono="buscar"
        tipo="search"
        name="busqueda"
        autocomplete="off"
        data-primer-campo
      />
      <p class="buscador__estado" aria-live="polite">{{ mensaje }}</p>
      <AvisoFz v-if="alta.errorBusqueda" variante="peligro">{{ alta.errorBusqueda }}</AvisoFz>
      <OpcionesTarjetaFz
        v-if="opciones.length > 0"
        compacta
        model-value=""
        nombre="usuario"
        leyenda="Resultados de la búsqueda"
        :opciones="opciones"
        @update:model-value="elegir"
      />
      <p v-if="alta.hayMasResultados" class="buscador__estado">Hay más resultados: afiná la búsqueda para verlos.</p>
    </template>

    <p v-if="alta.errores.usuario" class="buscador__error" role="alert">{{ alta.errores.usuario }}</p>
  </div>
</template>

<style scoped>
.buscador {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
}

/* La fila elegida lleva el aspecto de una opción elegida: fondo primario muy claro y borde fino. */
.buscador__elegido {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-compacto);
  padding: var(--fz-espaciado-compacto) var(--fz-espaciado-base);
  border: 1px solid var(--fz-color-borde-marcado);
  border-radius: var(--fz-radio-control);
  background: var(--fz-color-primario-fondo);
}

.buscador__texto {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--fz-espaciado-base);
  min-width: 0;
  margin: 0;
  font-size: var(--fz-texto-cuerpo);
}

.buscador__correo {
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

.buscador__estado {
  margin: 0;
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-minimo);
}

.buscador__error {
  margin: 0;
  color: var(--fz-color-peligro);
  font-size: var(--fz-texto-minimo);
}
</style>
