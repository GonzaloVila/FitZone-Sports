import { onMounted, onUnmounted, readonly, ref } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { Bloqueado } from '../services/servicioAcceso'

// RNF-01: el puesto de control guarda la lista de socios con la membresía no vigente para poder rechazar un ingreso
// sin conexión, en vez de encolarlo y enterarse del rechazo recién al sincronizar.
export type Bloqueo = Pick<Bloqueado, 'motivo' | 'desde'>

export interface ListaBloqueadosLocal {
  // socioId -> por qué y desde cuándo no está vigente.
  bloqueados: Record<string, Bloqueo>
  // Hora del servidor de la última sincronización (no la del puesto, que puede estar desfasada). null = nunca.
  ultimaSincronizacion: string | null
}

export const CLAVE_BLOQUEADOS = 'fitzone_bloqueados'

const LISTA_VACIA: ListaBloqueadosLocal = { bloqueados: {}, ultimaSincronizacion: null }

function cargar(): ListaBloqueadosLocal {
  try {
    const guardada = localStorage.getItem(CLAVE_BLOQUEADOS)
    if (!guardada) return { ...LISTA_VACIA }
    const lista = JSON.parse(guardada) as Partial<ListaBloqueadosLocal>
    return {
      bloqueados: lista.bloqueados && typeof lista.bloqueados === 'object' ? lista.bloqueados : {},
      ultimaSincronizacion: typeof lista.ultimaSincronizacion === 'string' ? lista.ultimaSincronizacion : null,
    }
  } catch {
    return { ...LISTA_VACIA }
  }
}

function guardar(lista: ListaBloqueadosLocal) {
  try {
    localStorage.setItem(CLAVE_BLOQUEADOS, JSON.stringify(lista))
  } catch {
    // Sin espacio o almacenamiento bloqueado: la lista sigue en memoria mientras la pantalla esté abierta.
  }
}

// Dos modos de sincronizar:
// - completa (al abrir la pantalla, o si nunca se sincronizó): reemplaza la lista. Es la única forma de sacar a un socio
//   que volvió a estar vigente, porque GET /bloqueados solo informa a los que dejaron de estarlo.
// - incremental (al recuperar la conexión): pide solo los cambios desde la última y los suma a la lista.
export function useListaBloqueadosOffline() {
  const servicioAcceso = useServicios().acceso

  const lista = ref<ListaBloqueadosLocal>(cargar())
  const sincronizando = ref(false)
  const error = ref<string | null>(null)

  let enCurso: Promise<void> | null = null

  function sincronizar(opciones: { completa?: boolean } = {}): Promise<void> {
    enCurso ??= (async () => {
      const desde = opciones.completa ? null : lista.value.ultimaSincronizacion
      sincronizando.value = true
      error.value = null
      try {
        const respuesta = await servicioAcceso.listarBloqueados(desde ?? undefined)
        const bloqueados: Record<string, Bloqueo> = desde ? { ...lista.value.bloqueados } : {}
        for (const { socioId, motivo, desde: fecha } of respuesta.bloqueados) {
          bloqueados[String(socioId)] = { motivo, desde: fecha }
        }
        lista.value = { bloqueados, ultimaSincronizacion: respuesta.servidorTime }
        guardar(lista.value)
      } catch (e) {
        // Se conserva la lista anterior: una lista vieja sirve más que ninguna estando sin conexión.
        error.value = mensajeDeError(e, 'No se pudo actualizar la lista de socios inhabilitados.')
      } finally {
        sincronizando.value = false
        enCurso = null
      }
    })()
    return enCurso
  }

  function bloqueoDe(socioId: number): Bloqueo | null {
    return lista.value.bloqueados[String(socioId)] ?? null
  }

  function estaBloqueado(socioId: number): boolean {
    return bloqueoDe(socioId) !== null
  }

  const alRecuperarConexion = () => {
    void sincronizar()
  }

  onMounted(() => {
    window.addEventListener('online', alRecuperarConexion)
    if (navigator.onLine) void sincronizar({ completa: true })
  })

  onUnmounted(() => {
    window.removeEventListener('online', alRecuperarConexion)
  })

  return {
    lista: readonly(lista),
    sincronizando: readonly(sincronizando),
    error: readonly(error),
    sincronizar,
    bloqueoDe,
    estaBloqueado,
  }
}
