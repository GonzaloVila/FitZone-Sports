import { computed, ref, toValue, watch, type MaybeRefOrGetter, type WritableComputedRef } from 'vue'

// La sede que se está mirando en las pantallas de trabajo (acceso, clases, canchas). Es estado de módulo (no se guarda en
// el navegador): vive mientras la app esté abierta y la comparten todas las pantallas, así ir al historial y volver al
// aforo conserva la sede elegida.
const elegida = ref<number | null>(null)

// Sede activa. `sedes` es el listado disponible; `sedeFija` es la sede del RECEPCION, que trabaja en una sola
// y no puede cambiarla (con ella, la sede activa es siempre esa).
// - Sin elección (o si la elegida deja de existir), la activa es la primera sede disponible.
// - Escribir null vuelve al valor por defecto.
export function useSedeActiva(
  sedes: MaybeRefOrGetter<readonly { id: number }[]>,
  sedeFija?: MaybeRefOrGetter<number | null | undefined>,
): WritableComputedRef<number | null> {
  // Si la sede elegida ya no está en el listado, se descarta: la activa vuelve a ser la primera.
  watch(
    () => toValue(sedes),
    (lista) => {
      if (lista.length > 0 && elegida.value !== null && !lista.some((sede) => sede.id === elegida.value)) elegida.value = null
    },
    { immediate: true },
  )

  return computed<number | null>({
    get: () => {
      const fija = toValue(sedeFija)
      if (fija) return fija
      const lista = toValue(sedes)
      if (elegida.value !== null && lista.some((sede) => sede.id === elegida.value)) return elegida.value
      return lista[0]?.id ?? null
    },
    set: (id) => {
      if (!toValue(sedeFija)) elegida.value = id
    },
  })
}
