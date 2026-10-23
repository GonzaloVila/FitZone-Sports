import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { esErrorApiConEstado } from '@/compartido/http/errores'
import { NOMBRE_RUTA_NO_ENCONTRADA, rutaInicialPorRol } from '../acceso'
import type { Credenciales } from '../services/servicioSesion'
import { useSesionStore } from '../stores/sesionStore'

function mensajeDeError(e: unknown): string {
  if (esErrorApiConEstado(e, 401)) return 'Email o contraseña incorrectos'
  if (esErrorApiConEstado(e, 0)) return 'No se pudo conectar con el servidor'
  return 'No se pudo iniciar sesión. Probá de nuevo.'
}

export function useIniciarSesion() {
  const store = useSesionStore()
  const router = useRouter()
  const route = useRoute()

  const cargando = ref(false)
  const error = ref<string | null>(null)

  // Solo se acepta una ruta interna que exista; evita redirecciones a otros sitios (//host, \\host, URLs absolutas).
  function destinoDeRedirect(): string | null {
    const valor = route.query.redirect
    if (typeof valor !== 'string' || !valor.startsWith('/') || valor.startsWith('//') || valor.includes('\\')) {
      return null
    }
    const resuelta = router.resolve(valor)
    // La comodín matchea cualquier path, así que no cuenta como ruta existente.
    if (resuelta.matched.length === 0 || resuelta.name === 'login' || resuelta.name === NOMBRE_RUTA_NO_ENCONTRADA) {
      return null
    }
    return resuelta.fullPath
  }

  async function iniciarSesion(credenciales: Credenciales) {
    if (cargando.value) return
    cargando.value = true
    error.value = null
    try {
      await store.iniciarSesion(credenciales)
      await router.push(destinoDeRedirect() ?? rutaInicialPorRol(store.usuario?.rol ?? null))
    } catch (e) {
      error.value = mensajeDeError(e)
    } finally {
      cargando.value = false
    }
  }

  return { iniciarSesion, cargando, error }
}
