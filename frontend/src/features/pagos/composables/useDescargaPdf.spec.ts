import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDescargaPdf } from './useDescargaPdf'

const crearUrl = vi.fn(() => 'blob:test')
const revocarUrl = vi.fn()

describe('useDescargaPdf', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    crearUrl.mockClear()
    revocarUrl.mockClear()
    Object.defineProperty(URL, 'createObjectURL', { value: crearUrl, configurable: true, writable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revocarUrl, configurable: true, writable: true })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('ofrece el blob como descarga y libera la URL temporal', async () => {
    const { descargar } = useDescargaPdf()

    const ok = await descargar('comprobante-8.pdf', async () => new Blob(['pdf']))

    expect(ok).toBe(true)
    expect(crearUrl).toHaveBeenCalledTimes(1)
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
    expect(revocarUrl).not.toHaveBeenCalled()

    vi.runAllTimers()
    expect(revocarUrl).toHaveBeenCalledWith('blob:test')
  })

  it('deja el error visible si el PDF no se puede obtener', async () => {
    const { descargar, error } = useDescargaPdf()

    const ok = await descargar('comprobante-8.pdf', async () => {
      throw new Error('boom')
    })

    expect(ok).toBe(false)
    expect(error.value).toMatch(/descargar el PDF/i)
    expect(crearUrl).not.toHaveBeenCalled()
  })
})
