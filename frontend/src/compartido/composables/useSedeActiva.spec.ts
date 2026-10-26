import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useSedeActiva } from './useSedeActiva'

const sedes = (...ids: number[]) => ids.map((id) => ({ id }))

// Cada llamada vive en su propio scope, como en una pantalla.
function usar(...args: Parameters<typeof useSedeActiva>) {
  return effectScope().run(() => useSedeActiva(...args))!
}

describe('useSedeActiva', () => {
  beforeEach(() => {
    // El estado es de módulo: se lo deja limpio entre tests.
    usar(sedes(1)).value = null
  })

  it('por defecto es la primera sede disponible', () => {
    expect(usar(sedes(4, 2, 9)).value).toBe(4)
  })

  it('sin sedes todavía no hay sede activa, y cuando llegan toma la primera', async () => {
    const lista = ref(sedes())
    const activa = usar(lista)

    expect(activa.value).toBeNull()
    lista.value = sedes(5, 6)
    await nextTick()
    expect(activa.value).toBe(5)
  })

  it('elegir una sede la guarda', () => {
    const activa = usar(sedes(1, 2, 3))

    activa.value = 2

    expect(activa.value).toBe(2)
  })

  it('la elección se comparte entre pantallas: otra instancia la ve y la cambia', () => {
    const lista = sedes(1, 2, 3)
    const aforo = usar(lista)
    const historial = usar(lista)

    aforo.value = 3
    expect(historial.value).toBe(3)

    historial.value = 1
    expect(aforo.value).toBe(1)
  })

  it('se conserva al irse y volver (una instancia nueva arranca con la elegida)', () => {
    const lista = sedes(1, 2, 3)
    const scope = effectScope()
    scope.run(() => (useSedeActiva(lista).value = 2))
    scope.stop()

    expect(usar(lista).value).toBe(2)
  })

  it('si la elegida deja de existir vuelve a la primera, y no vuelve a aparecer sola si la sede regresa', async () => {
    const lista = ref(sedes(1, 2, 3))
    const activa = usar(lista)
    activa.value = 3

    lista.value = sedes(1, 2)
    await nextTick()
    expect(activa.value).toBe(1)

    lista.value = sedes(1, 2, 3)
    await nextTick()
    expect(activa.value).toBe(1)
  })

  it('una elección que no está en el listado no cuenta', () => {
    const activa = usar(sedes(1, 2))

    activa.value = 99

    expect(activa.value).toBe(1)
  })

  it('escribir null vuelve al valor por defecto', () => {
    const activa = usar(sedes(1, 2))
    activa.value = 2

    activa.value = null

    expect(activa.value).toBe(1)
  })

  it('con sede fija (RECEPCION) la activa es esa y no se puede cambiar, ni afecta a los demás', () => {
    const lista = sedes(1, 2, 3)
    const recepcion = usar(lista, 2)
    const gerente = usar(lista)

    recepcion.value = 3
    expect(recepcion.value).toBe(2)
    expect(gerente.value).toBe(1)
  })
})
