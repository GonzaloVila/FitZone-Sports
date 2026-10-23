<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useModoOscuro } from '@/compartido/composables/useModoOscuro'
import { rolPermitido } from '@/features/sesion/acceso'
import { useSesionStore } from '@/features/sesion/stores/sesionStore'
import { BotonFz, InsigniaFz, PlantillaAppFz } from '@/ui'

const NOMBRE_APP = 'FitZone Sports'

const router = useRouter()
const route = useRoute()
const sesion = useSesionStore()

const { temaOscuro, alternarTema, inicializarTema } = useModoOscuro()

onMounted(() => {
  inicializarTema()
})

// Inicial del usuario para el avatar
const inicialUsuario = computed(() => {
  const nombre = sesion.usuario?.rol ?? 'U'
  return nombre.charAt(0).toUpperCase()
})

const rolEtiqueta = computed(() => sesion.usuario?.rol ?? 'USUARIO')

// Los links salen de las rutas con meta.navegacion, filtradas por el rol de la sesión y ordenadas por `orden`.
const enlaces = computed(() => {
  const rol = sesion.usuario?.rol ?? null
  return router
    .getRoutes()
    .flatMap((ruta) =>
      ruta.meta.navegacion && rolPermitido(ruta.meta.roles, rol)
        ? [{ ruta: ruta.path, ...ruta.meta.navegacion }]
        : [],
    )
    .sort((a, b) => a.orden - b.orden)
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
  <PlantillaAppFz>
    <!-- Brand / Logo -->
    <template #encabezado>
      <div class="armazon-app__marca">
        <span class="armazon-app__logo-icono">⚡</span>
        <span class="armazon-app__logo-texto">{{ NOMBRE_APP }}</span>
      </div>
    </template>

    <!-- Navegación estilizada -->
    <template #navegacion>
      <ul class="armazon-app__lista">
        <li v-for="enlace in enlaces" :key="enlace.ruta">
          <RouterLink v-slot="{ href, navigate }" :to="enlace.ruta" custom>
            <a :href="href" class="armazon-app__enlace" :aria-current="marcaActual(enlace.ruta)" @click="navigate">
              {{ enlace.etiqueta }}
            </a>
          </RouterLink>
        </li>
      </ul>
    </template>

    <!-- Acciones, Chip de usuario y Toggle Dark Mode -->
    <template #acciones>
      <div class="armazon-app__acciones-grupo">
        <!-- Botón Modo Oscuro -->
        <button
          type="button"
          class="armazon-app__boton-tema"
          :title="temaOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          :aria-label="temaOscuro ? 'Modo claro' : 'Modo oscuro'"
          @click="alternarTema"
        >
          {{ temaOscuro ? '☀️' : '🌙' }}
        </button>

        <!-- Chip de Usuario -->
        <div class="armazon-app__usuario-chip">
          <div class="armazon-app__avatar" aria-hidden="true">
            {{ inicialUsuario }}
          </div>
          <div class="armazon-app__usuario-datos">
            <InsigniaFz variante="neutra">{{ rolEtiqueta }}</InsigniaFz>
          </div>
        </div>

        <BotonFz variante="fantasma" tamano="sm" :cargando="cerrando" @click="cerrarSesion">
          Cerrar sesión
        </BotonFz>
      </div>
    </template>

    <RouterView />
  </PlantillaAppFz>
</template>

<style scoped>
.armazon-app__marca {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.armazon-app__logo-icono {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  background: var(--fz-color-primario);
  color: var(--fz-color-texto-sobre-primario);
  border-radius: var(--fz-radio-control);
  font-size: 0.875rem;
}

.armazon-app__logo-texto {
  font-size: 1.125rem;
  color: var(--fz-color-texto);
}

.armazon-app__lista {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.armazon-app__enlace {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.875rem;
  border-radius: var(--fz-radio-control);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fz-color-texto-suave);
  text-decoration: none;
  transition: all 0.15s ease;
}

.armazon-app__enlace:hover {
  background: var(--fz-color-hover);
  color: var(--fz-color-texto);
}

.armazon-app__enlace[aria-current] {
  background: var(--fz-color-hover);
  color: var(--fz-color-primario);
  font-weight: 600;
}

.armazon-app__acciones-grupo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.armazon-app__boton-tema {
  background: var(--fz-color-hover);
  border: 1px solid var(--fz-color-borde);
  border-radius: var(--fz-radio-control);
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.15s;
}

.armazon-app__boton-tema:hover {
  background: var(--fz-color-borde);
}

.armazon-app__usuario-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-right: 0.25rem;
  border-right: 1px solid var(--fz-color-borde);
}

.armazon-app__avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--fz-color-hover);
  border: 1px solid var(--fz-color-borde);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--fz-color-texto);
}
</style>
