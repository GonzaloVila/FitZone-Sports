import { ref } from 'vue'
import { mensajeDescarga } from '../errores'

export function useDescargaPdf() {
  const descargando = ref(false)
  const error = ref<string | null>(null)

  async function descargar(nombreArchivo: string, obtener: () => Promise<Blob>): Promise<boolean> {
    if (descargando.value) return false
    descargando.value = true
    error.value = null
    try {
      const blob = await obtener()
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = nombreArchivo
      enlace.rel = 'noopener'
      document.body.append(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      return true
    } catch (e) {
      error.value = mensajeDescarga(e)
      return false
    } finally {
      descargando.value = false
    }
  }

  return { descargando, error, descargar }
}
