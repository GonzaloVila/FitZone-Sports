import { onScopeDispose, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useServicios } from '@/compartido/servicios'
import type { Reservante } from '../tipos'

const POR_PAGINA_MAXIMA = 100
const CONCURRENCIA_NOMBRES = 4

// Quién reservó cada turno de una cancha en un día, para RECEPCION y GERENTE (SOCIO y EXTERNO no lo ven y no hacen ningún
// pedido). Devuelve un mapa del INSTANTE de inicio del turno (milisegundos, para comparar instantes y no textos con distinto
// formato u offset) a { usuarioId, nombre | null }.
//
// - Las reservas salen de GET /reservas-canchas (`canchaId`, `fecha`, `estado=CONFIRMADA`, el `perPage` máximo): el contrato
//   dice que trae las confirmadas activas, o sea con fin futuro, así que los turnos que ya terminaron no aparecen.
// - Los nombres, de GET /usuarios/{id}: un pedido por usuario distinto (caché por id), con concurrencia máxima de 4. Mientras
//   llega un nombre, o si el pedido falla (403, 404, red), el turno queda con `nombre: null` ("Usuario #id") sin ningún error.
// - Descarta respuestas viejas (número de carga + AbortController). `actualizar` es lo que dispara una recarga además de la
//   cancha, la fecha y el permiso: la pantalla le pasa la lista de turnos de la grilla, así se refresca con ella.
export function useReservantesDelDia(
  canchaId: MaybeRefOrGetter<number>,
  fecha: MaybeRefOrGetter<string>,
  habilitado: MaybeRefOrGetter<boolean>,
  actualizar?: MaybeRefOrGetter<unknown>,
) {
  const servicios = useServicios()

  const reservantes = shallowRef<ReadonlyMap<number, Reservante>>(new Map())
  // id de usuario → nombre. Solo se guardan los que llegaron: uno que falló se vuelve a intentar en la carga siguiente.
  const nombres = new Map<number, string>()

  let ultimaCarga = 0
  let controlador: AbortController | undefined

  function armar(reservas: { usuarioId: number; fechaHoraInicio: string }[]): ReadonlyMap<number, Reservante> {
    return new Map(
      reservas.map((reserva) => [
        new Date(reserva.fechaHoraInicio).getTime(),
        { usuarioId: reserva.usuarioId, nombre: nombres.get(reserva.usuarioId) ?? null },
      ]),
    )
  }

  async function cargarNombres(ids: number[], vigente: () => boolean, signal: AbortSignal, publicar: () => void) {
    let siguiente = 0
    async function trabajador() {
      while (siguiente < ids.length) {
        const id = ids[siguiente++]
        if (id === undefined || !vigente()) return
        try {
          const usuario = await servicios.usuarios.obtener(id, signal)
          if (vigente()) {
            nombres.set(id, usuario.nombre)
            publicar()
          }
        } catch {
          // Sin el nombre la fila dice "Usuario #id": no es un error de la pantalla.
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCIA_NOMBRES, ids.length) }, trabajador))
  }

  async function cargar() {
    const carga = ++ultimaCarga
    controlador?.abort()
    controlador = new AbortController()
    const { signal } = controlador

    const dia = toValue(fecha)
    if (!toValue(habilitado) || !dia) {
      reservantes.value = new Map()
      return
    }

    try {
      const lista = await servicios.canchas.listarReservas(
        { canchaId: toValue(canchaId), fecha: dia, estado: 'CONFIRMADA' },
        1,
        POR_PAGINA_MAXIMA,
        signal,
      )
      if (carga !== ultimaCarga) return

      reservantes.value = armar(lista.items)
      const faltan = [...new Set(lista.items.map((reserva) => reserva.usuarioId))].filter((id) => !nombres.has(id))
      await cargarNombres(
        faltan,
        () => carga === ultimaCarga,
        signal,
        () => {
          reservantes.value = armar(lista.items)
        },
      )
    } catch {
      // Sin la lista de reservas la columna queda vacía: no es un error de la pantalla.
      if (carga === ultimaCarga) reservantes.value = new Map()
    }
  }

  watch(
    [() => toValue(canchaId), () => toValue(fecha), () => toValue(habilitado), () => toValue(actualizar)],
    () => void cargar(),
    { immediate: true },
  )

  onScopeDispose(() => {
    ultimaCarga++
    controlador?.abort()
  })

  return { reservantes, recargar: cargar }
}

// El reservante del turno que empieza en `fechaHoraInicio` (cualquier formato ISO válido), o undefined si no hay.
export function reservanteDe(
  reservantes: ReadonlyMap<number, Reservante>,
  fechaHoraInicio: string,
): Reservante | undefined {
  return reservantes.get(new Date(fechaHoraInicio).getTime())
}
