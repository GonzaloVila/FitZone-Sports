<script setup lang="ts">
import { computed } from 'vue'
import type { Usuario } from '@/features/usuarios/services/servicioUsuarios'
import { AvatarFz, AvisoFz, BotonFz, IconoFz, InsigniaFz, InterruptorFz, MenuAccionesFz } from '@/ui'
import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_PLAN,
  VARIANTES_ESTADO,
  accionesDeMenuSocio,
  avisoDeMembresia,
  esAccionFicha,
  formatearFecha,
  textoVigencia,
} from '../presentacion'
import type { Membresia, Socio } from '../services/servicioSocios'
import type { AccionFicha, Opcional } from '../tipos'
import FilaFichaSocio from './FilaFichaSocio.vue'

const props = defineProps<{
  socio: Socio
  usuario: Opcional<Usuario>
  membresia: Opcional<Membresia>
  nombreSede: string
  // La renovación automática se está guardando: el interruptor queda ocupado.
  guardandoRenovacion: boolean
}>()

const emit = defineEmits<{
  'abrir-accion': [accion: AccionFicha]
  'alternar-renovacion': []
}>()

const datos = computed(() => (props.membresia.situacion === 'disponible' ? props.membresia.valor : null))
const aviso = computed(() => (datos.value ? avisoDeMembresia(datos.value) : null))
const acciones = computed(() => accionesDeMenuSocio(datos.value?.estado ?? null, 'ficha'))

// Dato que se pidió aparte y todavía no está: se dice si falta o si no se pudo obtener.
const pendiente = (dato: Opcional<unknown>) => (dato.situacion === 'cargando' ? 'Cargando…' : 'No disponible')

function alSeleccionar(clave: string) {
  if (esAccionFicha(clave)) emit('abrir-accion', clave)
}
</script>

<template>
  <article class="ficha" :aria-label="`Ficha de ${socio.nombre}`">
    <header class="ficha__cabecera">
      <AvatarFz :nombre="socio.nombre" tamano="lg" />
      <div class="ficha__identidad">
        <div class="ficha__linea">
          <h2 class="ficha__nombre">{{ socio.nombre }}</h2>
          <InsigniaFz v-if="datos" :variante="VARIANTES_ESTADO[datos.estado]">{{ ETIQUETAS_ESTADO[datos.estado] }}</InsigniaFz>
        </div>
        <p class="ficha__linea ficha__secundaria">
          DNI
          <span v-if="usuario.situacion === 'disponible'" class="ficha__mono">{{ usuario.valor.dni }}</span>
          <span v-else>{{ pendiente(usuario) }}</span>
          <template v-if="datos">
            <span aria-hidden="true">•</span>
            <InsigniaFz>{{ ETIQUETAS_PLAN[datos.plan] }}</InsigniaFz>
          </template>
        </p>
        <p class="ficha__linea ficha__secundaria">
          <IconoFz nombre="lugar" tamano="sm" />
          {{ nombreSede }}
        </p>
      </div>
      <MenuAccionesFz
        :etiqueta="`Acciones de ${socio.nombre}`"
        :identificador="`menu-socio-${socio.id}`"
        :acciones="acciones"
        @seleccionar="alSeleccionar"
      />
    </header>

    <p v-if="membresia.situacion === 'cargando'" class="ficha__secundaria">Cargando membresía…</p>
    <p v-else-if="membresia.situacion === 'no-disponible'" class="ficha__secundaria">No se pudo obtener la membresía.</p>
    <AvisoFz v-else-if="aviso" :variante="aviso.tono">
      <div class="ficha__aviso">
        <span>{{ aviso.texto }}</span>
        <BotonFz :variante="aviso.accion.variante" tamano="sm" @click="emit('abrir-accion', aviso.accion.clave)">
          {{ aviso.accion.etiqueta }}
        </BotonFz>
      </div>
    </AvisoFz>

    <dl class="ficha__filas">
      <FilaFichaSocio v-if="datos" etiqueta="Vigencia" icono="clases">
        <span :class="`ficha__vigencia--${datos.estado}`">{{ textoVigencia(datos) }}</span>
      </FilaFichaSocio>
      <FilaFichaSocio etiqueta="Fecha de alta" icono="clases">{{ formatearFecha(socio.fechaAlta) }}</FilaFichaSocio>
      <FilaFichaSocio etiqueta="Correo" icono="correo">{{ socio.email }}</FilaFichaSocio>
      <FilaFichaSocio etiqueta="Teléfono" icono="telefono">
        <template v-if="usuario.situacion === 'disponible'">{{ usuario.valor.telefono || 'Sin teléfono' }}</template>
        <span v-else class="ficha__secundaria">{{ pendiente(usuario) }}</span>
      </FilaFichaSocio>
      <FilaFichaSocio etiqueta="ID para accesos" icono="identificador">
        <span class="ficha__mono">{{ socio.id }}</span>
      </FilaFichaSocio>
      <FilaFichaSocio v-if="datos" etiqueta="Renovación automática" icono="cambiar">
        <InterruptorFz
          :model-value="datos.renuevaAutomatica"
          etiqueta="Renovación automática"
          :ocupado="guardandoRenovacion"
          @update:model-value="emit('alternar-renovacion')"
        />
      </FilaFichaSocio>
    </dl>
  </article>
</template>

<style scoped>
.ficha {
  display: flex;
  flex-direction: column;
  gap: var(--fz-espaciado-base);
  box-sizing: border-box;
  width: 100%;
  max-width: 28rem;
  padding: var(--fz-espaciado-amplio);
  border: 1px solid var(--fz-color-borde-marcado);
  border-radius: var(--fz-radio-control);
  background: var(--fz-color-fondo);
}

.ficha__cabecera {
  display: flex;
  align-items: flex-start;
  gap: var(--fz-espaciado-base);
}

.ficha__identidad {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--fz-espaciado-compacto);
  min-width: 0;
}

.ficha__linea {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--fz-espaciado-compacto);
  margin: 0;
}

.ficha__nombre {
  margin: 0;
  font-size: var(--fz-texto-subtitulo);
  font-weight: var(--fz-peso-enfasis);
  overflow-wrap: anywhere;
}

.ficha__secundaria {
  color: var(--fz-color-texto-suave);
  font-size: var(--fz-texto-pequeno);
}

p.ficha__secundaria {
  margin: 0;
}

.ficha__mono {
  font-family: var(--fz-fuente-mono);
}

.ficha__secundaria .ficha__mono {
  color: var(--fz-color-texto);
}

.ficha__aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--fz-espaciado-compacto);
}

.ficha__filas {
  margin: 0;
}

.ficha__vigencia--SUSPENDIDA {
  color: var(--fz-color-advertencia);
}

.ficha__vigencia--VENCIDA {
  color: var(--fz-color-peligro);
}
</style>
