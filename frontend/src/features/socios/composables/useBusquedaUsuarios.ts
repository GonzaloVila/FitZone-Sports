import { onScopeDispose, ref, watch } from 'vue'
import { mensajeDeError } from '@/compartido/http/errores'
import { useServicios } from '@/compartido/servicios'
import type { FiltrosUsuarios, Usuario } from '@/features/usuarios/services/servicioUsuarios'

export const ESPERA_BUSQUEDA_MS = 300
export const MINIMO_BUSQUEDA = 2
const RESULTADOS_POR_BUSQUEDA = 10

// Búsqueda de usuarios externos (los que todavía no tienen membresía) por nombre o correo, con espera de 300 ms
// después de la última tecla, un mínimo de 2 caracteres y descarte de las respuestas viejas.
export function useBusquedaUsuarios() {
  const servicio = useServicios().usuarios

  const busqueda = ref('')
  const textoAplicado = ref('')
  const resultados = ref<Usuario[]>([])
  const hayMasResultados = ref(false)
  const buscando = ref(false)
  // Ya hubo una búsqueda completa con ese texto (para distinguir "sin resultados" de "todavía no se buscó").
  const busquedaHecha = ref(false)
  const errorBusqueda = ref<string | null>(null)

  let temporizador: ReturnType<typeof setTimeout> | undefined
  watch(busqueda, (texto) => {
    clearTimeout(temporizador)
    temporizador = setTimeout(() => {
      textoAplicado.value = texto.trim()
    }, ESPERA_BUSQUEDA_MS)
  })

  // Cada búsqueda tiene un número y su propio AbortController: una respuesta con otro número se descarta.
  let ultimaBusqueda = 0
  let controlador: AbortController | undefined

  function limpiarResultados() {
    resultados.value = []
    hayMasResultados.value = false
    busquedaHecha.value = false
  }

  async function buscar() {
    const numero = ++ultimaBusqueda
    controlador?.abort()
    controlador = new AbortController()
    const texto = textoAplicado.value

    errorBusqueda.value = null
    if (texto.length < MINIMO_BUSQUEDA) {
      limpiarResultados()
      buscando.value = false
      return
    }

    buscando.value = true
    // Solo usuarios EXTERNO: un SOCIO ya es socio. El contrato filtra por email exacto o por nombre parcial.
    const filtros: FiltrosUsuarios = texto.includes('@') ? { rol: 'EXTERNO', email: texto } : { rol: 'EXTERNO', nombre: texto }
    try {
      const lista = await servicio.listar(filtros, 1, RESULTADOS_POR_BUSQUEDA, controlador.signal)
      if (numero !== ultimaBusqueda) return
      resultados.value = lista.items
      hayMasResultados.value = lista.total > lista.items.length
      busquedaHecha.value = true
    } catch (e) {
      if (numero !== ultimaBusqueda) return
      resultados.value = []
      hayMasResultados.value = false
      errorBusqueda.value = mensajeDeError(e, 'No se pudo buscar usuarios.')
    } finally {
      if (numero === ultimaBusqueda) buscando.value = false
    }
  }
  watch(textoAplicado, () => void buscar())

  // Vuelve al estado inicial y descarta cualquier respuesta que todavía esté en camino.
  function reiniciar() {
    clearTimeout(temporizador)
    ultimaBusqueda++
    controlador?.abort()
    busqueda.value = ''
    textoAplicado.value = ''
    limpiarResultados()
    buscando.value = false
    errorBusqueda.value = null
  }

  onScopeDispose(() => {
    clearTimeout(temporizador)
    ultimaBusqueda++
    controlador?.abort()
  })

  return { busqueda, resultados, hayMasResultados, buscando, busquedaHecha, errorBusqueda, reiniciar }
}
