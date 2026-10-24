<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter, type RouteMeta } from 'vue-router'
import { usePerfilSesion } from '@/features/sesion/composables/usePerfilSesion'
import { rolPermitido } from '@/features/sesion/acceso'
import { etiquetaRol } from '@/features/sesion/presentacion'
import { useSesionStore } from '@/features/sesion/stores/sesionStore'
import { IconoFz, PlantillaAppFz } from '@/ui'

const NOMBRE_APP = 'FitZone Sports'

type Seccion = NonNullable<NonNullable<RouteMeta['navegacion']>['seccion']>

// Orden en que se apilan las secciones en la barra lateral y el título de cada una.
const SECCIONES: readonly { clave: Seccion; titulo: string }[] = [
  { clave: 'operaciones', titulo: 'Operaciones' },
  { clave: 'actividades', titulo: 'Clases y deporte' },
  { clave: 'administracion', titulo: 'Administración' },
]

const router = useRouter()
const route = useRoute()
const sesion = useSesionStore()
const perfil = usePerfilSesion()

const rol = computed(() => sesion.usuario?.rol ?? null)
const rolEtiqueta = computed(() => etiquetaRol(rol.value))

// RECEPCION y GERENTE trabajan con barra lateral; SOCIO y EXTERNO, con barra superior.
const lateral = computed(() => rol.value === 'RECEPCION' || rol.value === 'GERENTE')
const disposicion = computed(() => (lateral.value ? 'barra-lateral' : 'barra-superior'))

// Sin nombre (todavía o porque falló la consulta) se muestra el rol y su inicial.
const nombreVisible = computed(() => perfil.nombre.value ?? rolEtiqueta.value)
const inicialUsuario = computed(() => nombreVisible.value.charAt(0).toUpperCase())

// Los links salen de las rutas con meta.navegacion, filtradas por el rol de la sesión y ordenadas por `orden`.
const enlaces = computed(() =>
  router
    .getRoutes()
    .flatMap((ruta) =>
      ruta.meta.navegacion && rolPermitido(ruta.meta.roles, rol.value)
        ? [{ ruta: ruta.path, ...ruta.meta.navegacion }]
        : [],
    )
    .sort((a, b) => a.orden - b.orden),
)

// Barra lateral: los links sin sección van arriba, sin título, y después un grupo por sección.
// Barra superior: una lista plana. Un grupo sin links no se muestra (ni su título).
const grupos = computed(() => {
  const todos = !lateral.value
    ? [{ clave: 'todos', titulo: null, enlaces: enlaces.value }]
    : [
        { clave: 'general', titulo: null, enlaces: enlaces.value.filter((enlace) => !enlace.seccion) },
        ...SECCIONES.map(({ clave, titulo }) => ({
          clave,
          titulo,
          enlaces: enlaces.value.filter((enlace) => enlace.seccion === clave),
        })),
      ]
  return todos.filter((grupo) => grupo.enlaces.length > 0)
})

function marcaActual(rutaEnlace: string): 'page' | 'true' | undefined {
  if (route.path === rutaEnlace) return 'page'
  return route.path.startsWith(`${rutaEnlace}/`) ? 'true' : undefined
}

const cerrando = ref(false)

async function cerrarSesion() {
  cerrando.value = true
  try {
    await sesion.cerrarSesion()
  } catch {
    // Si falla el aviso al servidor, el store ya limpió la sesión local: igual se sale.
  } finally {
    cerrando.value = false
  }
  await router.push({ name: 'login' })
}
</script>

<template>
  <PlantillaAppFz :disposicion="disposicion">
    <template #encabezado>
      <div class="armazon-app__identidad">
        <div class="armazon-app__marca">
          <span class="armazon-app__logo" aria-hidden="true">F</span>
          <span>{{ NOMBRE_APP }}</span>
        </div>
        <span v-if="lateral && perfil.nombreSede.value" class="armazon-app__sede" :title="perfil.nombreSede.value">
          {{ perfil.nombreSede.value }}
        </span>
      </div>
    </template>

    <template v-if="grupos.length > 0" #navegacion>
      <div class="armazon-app__grupos">
        <div v-for="grupo in grupos" :key="grupo.clave" class="armazon-app__grupo">
          <p v-if="grupo.titulo" :id="`armazon-seccion-${grupo.clave}`" class="armazon-app__seccion">
            {{ grupo.titulo }}
          </p>
          <ul
            :class="['armazon-app__lista', { 'armazon-app__lista--lateral': lateral }]"
            :aria-labelledby="grupo.titulo ? `armazon-seccion-${grupo.clave}` : undefined"
          >
            <li v-for="enlace in grupo.enlaces" :key="enlace.ruta">
              <RouterLink v-slot="{ href, navigate }" :to="enlace.ruta" custom>
                <a :href="href" class="armazon-app__enlace" :aria-current="marcaActual(enlace.ruta)" @click="navigate">
                  <IconoFz v-if="enlace.icono" :nombre="enlace.icono" tamano="sm" class="armazon-app__icono" />
                  <span>{{ enlace.etiqueta }}</span>
                </a>
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <template v-if="lateral" #pie>
      <div class="armazon-app__pie">
        <div class="armazon-app__usuario">
          <span class="armazon-app__avatar" aria-hidden="true">{{ inicialUsuario }}</span>
          <span class="armazon-app__datos">
            <span class="armazon-app__nombre" :title="nombreVisible">{{ nombreVisible }}</span>
            <span v-if="perfil.nombre.value" class="armazon-app__detalle">{{ rolEtiqueta }}</span>
            <span v-if="perfil.email.value" class="armazon-app__detalle" :title="perfil.email.value">
              {{ perfil.email.value }}
            </span>
          </span>
        </div>
        <button
          type="button"
          class="armazon-app__salir"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          :disabled="cerrando"
          :aria-busy="cerrando || undefined"
          @click="cerrarSesion"
        >
          <IconoFz nombre="cerrar-sesion" tamano="sm" />
        </button>
      </div>
    </template>

    <template v-else #acciones>
      <div class="armazon-app__acciones">
        <span class="armazon-app__usuario-compacto">
          <span class="armazon-app__nombre" :title="nombreVisible">{{ nombreVisible }}</span>
          <span v-if="perfil.nombre.value" class="armazon-app__detalle">{{ rolEtiqueta }}</span>
        </span>
        <button
          type="button"
          class="armazon-app__salir armazon-app__salir--texto"
          :disabled="cerrando"
          :aria-busy="cerrando || undefined"
          @click="cerrarSesion"
        >
          <IconoFz nombre="cerrar-sesion" tamano="sm" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </template>

    <RouterView />
  </PlantillaAppFz>
</template>

<style scoped>
/* ---- Marca ---- */
.armazon-app__identidad {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Alineada con el texto de la marca, no con el logo. */
.armazon-app__sede {
  padding-left: calc(var(--fz-armazon-logo-tamano) + var(--fz-armazon-marca-separacion));
  overflow: hidden;
  font-size: var(--fz-armazon-sede-texto);
  font-weight: var(--fz-peso-normal);
  color: var(--fz-armazon-sede-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.armazon-app__marca {
  display: flex;
  align-items: center;
  gap: var(--fz-armazon-marca-separacion);
}

.armazon-app__logo {
  display: grid;
  place-items: center;
  width: var(--fz-armazon-logo-tamano);
  height: var(--fz-armazon-logo-tamano);
  border-radius: var(--fz-armazon-logo-radio);
  background: var(--fz-armazon-logo-fondo);
  color: var(--fz-armazon-logo-texto);
  font-size: var(--fz-armazon-logo-texto-tamano);
  font-weight: var(--fz-armazon-marca-peso);
  line-height: 1;
}

/* ---- Navegación ---- */
.armazon-app__grupos {
  display: flex;
  flex-direction: column;
  gap: var(--fz-armazon-grupo-separacion);
}

.armazon-app__grupo {
  display: flex;
  flex-direction: column;
  gap: var(--fz-armazon-enlace-separacion);
}

.armazon-app__seccion {
  margin: 0;
  padding: 0 var(--fz-armazon-seccion-titulo-relleno-x);
  font-size: var(--fz-armazon-seccion-titulo-texto);
  font-weight: var(--fz-armazon-seccion-titulo-peso);
  letter-spacing: var(--fz-armazon-seccion-titulo-espaciado);
  text-transform: uppercase;
  color: var(--fz-armazon-seccion-titulo-color);
}

.armazon-app__lista {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fz-armazon-enlace-separacion);
  margin: 0;
  padding: 0;
  list-style: none;
}

.armazon-app__lista--lateral {
  flex-direction: column;
  flex-wrap: nowrap;
}

.armazon-app__enlace {
  display: flex;
  align-items: center;
  gap: var(--fz-armazon-enlace-separacion);
  min-height: var(--fz-armazon-enlace-alto-min);
  padding: 0 var(--fz-armazon-enlace-relleno-x);
  border-radius: var(--fz-armazon-enlace-radio);
  font-size: var(--fz-armazon-enlace-texto);
  color: var(--fz-armazon-enlace-color);
  text-decoration: none;
}

.armazon-app__enlace:hover {
  background: var(--fz-armazon-enlace-fondo-hover);
}

.armazon-app__enlace[aria-current] {
  background: var(--fz-armazon-enlace-activo-fondo);
  font-weight: var(--fz-armazon-enlace-peso-activo);
}

.armazon-app__enlace:focus-visible,
.armazon-app__salir:focus-visible {
  outline: var(--fz-armazon-foco-ancho) solid var(--fz-armazon-foco-color);
  outline-offset: var(--fz-armazon-foco-separacion);
}

.armazon-app__icono {
  color: var(--fz-armazon-enlace-icono-color);
}

.armazon-app__enlace[aria-current] .armazon-app__icono {
  color: var(--fz-armazon-enlace-icono-activo);
}

/* ---- Usuario ---- */
.armazon-app__pie {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--fz-armazon-usuario-separacion);
}

.armazon-app__usuario {
  display: flex;
  align-items: center;
  gap: var(--fz-armazon-usuario-separacion);
  min-width: 0;
}

.armazon-app__avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--fz-armazon-avatar-tamano);
  height: var(--fz-armazon-avatar-tamano);
  border-radius: var(--fz-armazon-avatar-radio);
  background: var(--fz-armazon-avatar-fondo);
  color: var(--fz-armazon-avatar-texto);
  font-size: var(--fz-armazon-usuario-nombre-texto);
  font-weight: var(--fz-armazon-usuario-nombre-peso);
}

.armazon-app__datos {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.armazon-app__nombre,
.armazon-app__detalle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.armazon-app__nombre {
  font-size: var(--fz-armazon-usuario-nombre-texto);
  font-weight: var(--fz-armazon-usuario-nombre-peso);
  color: var(--fz-armazon-avatar-texto);
}

.armazon-app__detalle {
  font-size: var(--fz-armazon-usuario-detalle-texto);
  color: var(--fz-armazon-usuario-detalle-color);
}

.armazon-app__usuario-compacto {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 0;
  max-width: 12rem;
}

.armazon-app__acciones {
  display: flex;
  align-items: center;
  gap: var(--fz-armazon-separacion);
}

/* ---- Cerrar sesión ---- */
.armazon-app__salir {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--fz-armazon-enlace-separacion);
  align-self: flex-end;
  min-width: var(--fz-armazon-salir-tamano);
  min-height: var(--fz-armazon-salir-tamano);
  padding: 0;
  border: none;
  border-radius: var(--fz-armazon-enlace-radio);
  background: transparent;
  color: var(--fz-armazon-salir-color);
  font-family: inherit;
  font-size: var(--fz-armazon-enlace-texto);
  cursor: pointer;
}

.armazon-app__salir--texto {
  align-self: auto;
  padding: 0 var(--fz-armazon-enlace-relleno-x);
}

.armazon-app__salir:hover:not(:disabled) {
  background: var(--fz-armazon-salir-fondo-hover);
  color: var(--fz-armazon-salir-color-hover);
}

.armazon-app__salir:disabled {
  cursor: progress;
  opacity: 0.6;
}
</style>
