import { onScopeDispose, shallowRef } from 'vue'
import { useServicios } from '@/compartido/servicios'
import { armarDatosDeCanchas, etiquetaDeCancha, sedeDeCancha, type DatosDeCanchas } from '../etiquetas'

const POR_PAGINA = 100

// Los datos de las canchas para "Mis reservas" (nombre y sede): una sola consulta a GET /canchas (todas las sedes, sin
// filtros) al montarse. Si falla, o una cancha no aparece, `etiquetaDe` devuelve "Cancha #N" y `sedeIdDe` null (la pantalla
// no se rompe por esto).
export function useEtiquetasCanchas() {
  const servicio = useServicios().canchas
  const datos = shallowRef<DatosDeCanchas>(new Map())
  const controlador = new AbortController()

  async function cargar() {
    try {
      const lista = await servicio.buscar({}, 1, POR_PAGINA, controlador.signal)
      datos.value = armarDatosDeCanchas(lista.items)
    } catch {
      // Sin el mapa se muestra "Cancha #N" y la sede en blanco.
    }
  }

  onScopeDispose(() => controlador.abort())
  void cargar()

  return {
    etiquetaDe: (canchaId: number) => etiquetaDeCancha(datos.value, canchaId),
    sedeIdDe: (canchaId: number) => sedeDeCancha(datos.value, canchaId),
  }
}
