import { computed } from 'vue'
import { useSesionStore } from '../stores/sesionStore'

// Datos de solo lectura de la sesión para otras features: así no importan el store directamente.
export function useUsuarioSesion() {
  const store = useSesionStore()

  const rol = computed(() => store.usuario?.rol ?? null)
  const socioId = computed(() => store.usuario?.socioId ?? null)

  return { rol, socioId }
}
