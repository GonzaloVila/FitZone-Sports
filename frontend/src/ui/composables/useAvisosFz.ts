import { readonly, ref } from 'vue'

export type TipoAvisoFlotante = 'exito' | 'error' | 'info'

export interface AvisoFlotante {
  id: number
  tipo: TipoAvisoFlotante
  titulo: string
  descripcion?: string
  duracionMs: number
}

// Cuántos avisos puede haber a la vez: al pasarse se descarta el más viejo.
const MAXIMO_VISIBLES = 4

const DURACION_POR_DEFECTO: Record<TipoAvisoFlotante, number> = {
  exito: 5000,
  info: 5000,
  error: 8000,
}

// Estado a nivel de módulo: todos los que llaman a useAvisosFz() comparten la misma cola.
const cola = ref<AvisoFlotante[]>([])
let ultimoId = 0

// El cierre automático lo maneja este módulo (no el componente), para que un aviso no quede colgado aunque
// no haya contenedor montado. Se puede pausar (hover y foco sobre el aviso) y reanudar con el tiempo que quedaba.
interface Temporizador {
  manejador: ReturnType<typeof setTimeout> | null
  restanteMs: number
  inicio: number
}
const temporizadores = new Map<number, Temporizador>()

function arrancar(id: number, temporizador: Temporizador) {
  temporizador.inicio = Date.now()
  temporizador.manejador = setTimeout(() => cerrar(id), temporizador.restanteMs)
}

function detener(id: number) {
  const temporizador = temporizadores.get(id)
  if (temporizador?.manejador) clearTimeout(temporizador.manejador)
  temporizadores.delete(id)
}

function cerrar(id: number) {
  detener(id)
  cola.value = cola.value.filter((aviso) => aviso.id !== id)
}

function cerrarTodos() {
  for (const aviso of cola.value) detener(aviso.id)
  cola.value = []
}

function pausar(id: number) {
  const temporizador = temporizadores.get(id)
  if (!temporizador?.manejador) return
  clearTimeout(temporizador.manejador)
  temporizador.manejador = null
  temporizador.restanteMs = Math.max(0, temporizador.restanteMs - (Date.now() - temporizador.inicio))
}

function reanudar(id: number) {
  const temporizador = temporizadores.get(id)
  if (temporizador && !temporizador.manejador) arrancar(id, temporizador)
}

// Devuelve el id del aviso (si ya había uno idéntico visible, el de ese).
function agregar(tipo: TipoAvisoFlotante, titulo: string, descripcion?: string, duracionMs?: number): number {
  const repetido = cola.value.find(
    (aviso) => aviso.tipo === tipo && aviso.titulo === titulo && aviso.descripcion === descripcion,
  )
  if (repetido) return repetido.id

  const aviso: AvisoFlotante = {
    id: ++ultimoId,
    tipo,
    titulo,
    descripcion,
    duracionMs: duracionMs ?? DURACION_POR_DEFECTO[tipo],
  }
  const siguientes = [...cola.value, aviso]
  for (const descartado of siguientes.splice(0, Math.max(0, siguientes.length - MAXIMO_VISIBLES))) {
    detener(descartado.id)
  }
  cola.value = siguientes

  // Duración 0 (o no finita) = el aviso queda hasta que se lo cierre.
  if (Number.isFinite(aviso.duracionMs) && aviso.duracionMs > 0) {
    const temporizador: Temporizador = { manejador: null, restanteMs: aviso.duracionMs, inicio: 0 }
    temporizadores.set(aviso.id, temporizador)
    arrancar(aviso.id, temporizador)
  }
  return aviso.id
}

export function useAvisosFz() {
  return {
    avisos: readonly(cola),
    exito: (titulo: string, descripcion?: string, duracionMs?: number) => agregar('exito', titulo, descripcion, duracionMs),
    error: (titulo: string, descripcion?: string, duracionMs?: number) => agregar('error', titulo, descripcion, duracionMs),
    info: (titulo: string, descripcion?: string, duracionMs?: number) => agregar('info', titulo, descripcion, duracionMs),
    cerrar,
    cerrarTodos,
    // Para ContenedorAvisosFz (hover y foco); no hace falta llamarlos desde las pantallas.
    pausar,
    reanudar,
  }
}
