import { onUnmounted, readonly, ref, type DeepReadonly, type Ref } from 'vue'

export function useEstadoConexion(): { enLinea: DeepReadonly<Ref<boolean>> } {
  const enLinea = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

  const actualizarOnline = () => {
    enLinea.value = true
  }

  const actualizarOffline = () => {
    enLinea.value = false
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', actualizarOnline)
    window.addEventListener('offline', actualizarOffline)

    onUnmounted(() => {
      window.removeEventListener('online', actualizarOnline)
      window.removeEventListener('offline', actualizarOffline)
    })
  }

  return {
    enLinea: readonly(enLinea),
  }
}
