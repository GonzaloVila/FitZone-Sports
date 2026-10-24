import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAvisosFz } from './useAvisosFz'

describe('useAvisosFz', () => {
  const avisos = useAvisosFz()

  beforeEach(() => {
    vi.useFakeTimers()
    avisos.cerrarTodos()
  })

  afterEach(() => {
    avisos.cerrarTodos()
    vi.useRealTimers()
  })

  it('agrega avisos con su tipo, título, descripción y la duración por defecto de cada tipo', () => {
    avisos.exito('Guardado', 'El socio quedó registrado')
    avisos.error('No se pudo guardar')
    avisos.info('Sincronizando')

    expect(avisos.avisos.value.map(({ tipo, titulo, descripcion, duracionMs }) => ({ tipo, titulo, descripcion, duracionMs }))).toEqual([
      { tipo: 'exito', titulo: 'Guardado', descripcion: 'El socio quedó registrado', duracionMs: 5000 },
      { tipo: 'error', titulo: 'No se pudo guardar', descripcion: undefined, duracionMs: 8000 },
      { tipo: 'info', titulo: 'Sincronizando', descripcion: undefined, duracionMs: 5000 },
    ])
  })

  it('permite sobreescribir la duración con el último parámetro', () => {
    avisos.exito('Guardado', undefined, 1200)

    expect(avisos.avisos.value[0]?.duracionMs).toBe(1200)
  })

  it('no agrega un aviso idéntico a uno visible, y devuelve el id del que ya estaba', () => {
    const primero = avisos.exito('Guardado', 'Detalle')
    const repetido = avisos.exito('Guardado', 'Detalle')

    expect(repetido).toBe(primero)
    expect(avisos.avisos.value).toHaveLength(1)
  })

  it('un aviso con otro tipo o con otra descripción no cuenta como repetido', () => {
    avisos.exito('Guardado', 'Detalle')
    avisos.info('Guardado', 'Detalle')
    avisos.exito('Guardado', 'Otro detalle')
    avisos.exito('Guardado')

    expect(avisos.avisos.value).toHaveLength(4)
  })

  it('un aviso que ya se cerró se puede volver a mostrar', () => {
    const id = avisos.exito('Guardado')
    avisos.cerrar(id)
    avisos.exito('Guardado')

    expect(avisos.avisos.value).toHaveLength(1)
  })

  it('muestra como máximo 4 y descarta el más viejo', () => {
    for (const titulo of ['uno', 'dos', 'tres', 'cuatro', 'cinco']) avisos.info(titulo)

    expect(avisos.avisos.value.map((aviso) => aviso.titulo)).toEqual(['dos', 'tres', 'cuatro', 'cinco'])
  })

  it('cierra por id sin tocar los demás', () => {
    const a = avisos.info('a')
    avisos.info('b')

    avisos.cerrar(a)

    expect(avisos.avisos.value.map((aviso) => aviso.titulo)).toEqual(['b'])
  })

  it('cerrarTodos vacía la cola', () => {
    avisos.info('a')
    avisos.error('b')

    avisos.cerrarTodos()

    expect(avisos.avisos.value).toHaveLength(0)
  })

  it('se cierra solo: 5 s éxito e info, 8 s error', () => {
    avisos.exito('ok')
    avisos.info('dato')
    avisos.error('falla')

    vi.advanceTimersByTime(4999)
    expect(avisos.avisos.value).toHaveLength(3)

    vi.advanceTimersByTime(1)
    expect(avisos.avisos.value.map((aviso) => aviso.titulo)).toEqual(['falla'])

    vi.advanceTimersByTime(2999)
    expect(avisos.avisos.value).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(avisos.avisos.value).toHaveLength(0)
  })

  it('respeta la duración sobreescrita para el cierre automático', () => {
    avisos.error('falla', undefined, 1000)

    vi.advanceTimersByTime(1000)

    expect(avisos.avisos.value).toHaveLength(0)
  })

  it('con duración 0 el aviso queda hasta que se lo cierra', () => {
    avisos.info('fijo', undefined, 0)

    vi.advanceTimersByTime(60_000)

    expect(avisos.avisos.value).toHaveLength(1)
  })

  it('al pausar se detiene el reloj y al reanudar corre solo lo que faltaba', () => {
    const id = avisos.exito('ok')
    vi.advanceTimersByTime(3000)

    avisos.pausar(id)
    vi.advanceTimersByTime(60_000)
    expect(avisos.avisos.value).toHaveLength(1)

    avisos.reanudar(id)
    vi.advanceTimersByTime(1999)
    expect(avisos.avisos.value).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(avisos.avisos.value).toHaveLength(0)
  })

  it('el aviso descartado por el límite no deja un temporizador vivo', () => {
    for (const titulo of ['uno', 'dos', 'tres', 'cuatro', 'cinco']) avisos.info(titulo)

    // 'uno' ya no está: sus 5 s no tienen que tocar a los demás ni fallar.
    expect(avisos.avisos.value).toHaveLength(4)
    expect(vi.getTimerCount()).toBe(4)
  })
})
