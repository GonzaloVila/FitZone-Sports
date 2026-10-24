import { computed } from 'vue'
import { useSesionStore } from '../stores/sesionStore'

// Datos de solo lectura de la sesión para otras features: así no importan el store directamente.
export function useUsuarioSesion() {
  const store = useSesionStore()

  const rol = computed(() => store.usuario?.rol ?? null)
  // ID del usuario autenticado (clave de Usuario). Lo usan M4/M5 para reservar y pagar.
  const usuarioId = computed<number | null>(() => store.usuario?.usuarioId ?? null)
  const socioId = computed(() => store.usuario?.socioId ?? null)
  // Sede de trabajo del RECEPCION. null = sin sede fija (GERENTE) o sin dato.
  const sedeId = computed<number | null>(() => store.usuario?.sedeId ?? null)

  return { rol, usuarioId, socioId, sedeId }
}
