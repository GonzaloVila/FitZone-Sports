import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useServicios } from '@/compartido/servicios'
import type { Credenciales } from '../services/servicioSesion'
import { usuarioDesdeSesion, type UsuarioSesion } from '../tipos'

// Guarda solo quién es el usuario. El access token vive en el almacén de compartido/http y no se persiste.
export const useSesionStore = defineStore('sesion', () => {
  const servicios = useServicios()

  const usuario = ref<UsuarioSesion | null>(null)
  const restaurada = ref(false)
  const estaAutenticado = computed(() => usuario.value !== null)

  async function iniciarSesion(credenciales: Credenciales) {
    usuario.value = usuarioDesdeSesion(await servicios.sesion.iniciarSesion(credenciales))
  }

  // Intenta recuperar la sesión con la cookie de refresh (F5 o primera visita). Corre una sola vez;
  // si no hay sesión que recuperar no es un error: el usuario simplemente queda sin sesión.
  let restauracion: Promise<void> | null = null
  function restaurar(): Promise<void> {
    restauracion ??= (async () => {
      try {
        usuario.value = usuarioDesdeSesion(await servicios.sesion.renovar())
      } catch {
        usuario.value = null
      } finally {
        restaurada.value = true
      }
    })()
    return restauracion
  }

  async function cerrarSesion() {
    try {
      await servicios.sesion.cerrarSesion()
    } finally {
      usuario.value = null
    }
  }

  // Solo borra el usuario (sin llamar a la API): la usa alExpirarSesion.
  function limpiar() {
    usuario.value = null
  }

  return { usuario, restaurada, estaAutenticado, iniciarSesion, restaurar, cerrarSesion, limpiar }
})
