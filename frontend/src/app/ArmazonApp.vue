<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { rolPermitido } from '@/features/sesion/acceso'
import { useSesionStore } from '@/features/sesion/stores/sesionStore'
import { BotonFz, PlantillaAppFz } from '@/ui'

const NOMBRE_APP = 'FitZone Sports'

const router = useRouter()
const route = useRoute()
const sesion = useSesionStore()

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

// "page" en la ruta exacta; "true" en las subrutas de la sección (por ejemplo, /socios/5 y /socios/nuevo
// dejan resaltado "Socios").
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
    <template #encabezado>{{ NOMBRE_APP }}</template>

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

    <template #acciones>
      <BotonFz variante="fantasma" tamano="sm" :cargando="cerrando" @click="cerrarSesion">
        Cerrar sesión
      </BotonFz>
    </template>

    <RouterView />
  </PlantillaAppFz>
</template>

<style scoped>
.armazon-app__lista {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fz-armazon-enlace-separacion);
  margin: 0;
  padding: 0;
  list-style: none;
}

.armazon-app__enlace {
  display: inline-flex;
  align-items: center;
  min-height: var(--fz-armazon-enlace-alto-min);
  padding: 0 var(--fz-armazon-enlace-relleno-x);
  border-bottom: var(--fz-armazon-enlace-indicador-ancho) solid transparent;
  border-radius: var(--fz-armazon-enlace-radio);
  font-size: var(--fz-armazon-enlace-texto);
  color: var(--fz-armazon-enlace-color);
  text-decoration: none;
}

.armazon-app__enlace:hover {
  background: var(--fz-armazon-enlace-fondo-hover);
}

.armazon-app__enlace[aria-current] {
  border-bottom-color: var(--fz-armazon-enlace-indicador-activo);
  background: var(--fz-armazon-enlace-fondo-hover);
  font-weight: var(--fz-armazon-enlace-peso-activo);
}

.armazon-app__enlace:focus-visible {
  outline: var(--fz-armazon-foco-ancho) solid var(--fz-armazon-foco-color);
  outline-offset: var(--fz-armazon-foco-separacion);
}
</style>
