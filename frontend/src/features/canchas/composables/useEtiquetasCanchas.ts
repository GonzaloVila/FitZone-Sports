import { onScopeDispose, shallowRef } from 'vue'
import { useServicios } from '@/compartido/servicios'
import { armarEtiquetasCanchas, etiquetaDeCancha, type EtiquetasCanchas } from '../etiquetas'

const POR_PAGINA = 100

// Los nombres de las canchas para "Mis reservas": una sola consulta a GET /canchas (todas las sedes, sin filtros) al
// montarse. Si falla, o una cancha no aparece, `etiquetaDe` devuelve "Cancha #N" (la pantalla no se rompe por esto).
export function useEtiquetasCanchas() {
  const servicio = useServicios().canchas
  const etiquetas = shallowRef<EtiquetasCanchas>(new Map())
  const controlador = new AbortController()

  async function cargar() {
    try {
      const lista = await servicio.buscar({}, 1, POR_PAGINA, controlador.signal)
      etiquetas.value = armarEtiquetasCanchas(lista.items)
    } catch {
      // Sin el mapa se muestra "Cancha #N".
    }
  }

  onScopeDispose(() => controlador.abort())
  void cargar()

  return { etiquetaDe: (canchaId: number) => etiquetaDeCancha(etiquetas.value, canchaId) }
}
