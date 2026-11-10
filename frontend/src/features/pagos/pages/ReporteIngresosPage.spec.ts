import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorApi } from '@/compartido/http/errores'
import { ServiciosKey } from '@/compartido/servicios'
import ReporteIngresosPage from './ReporteIngresosPage.vue'

// RF-14: el reporte de ingresos en PDF del GERENTE, con un rango de fechas opcional.
enableAutoUnmount(afterEach)

const servicios = { pagos: { descargarReporte: vi.fn() } }
let descargados: string[]

async function montar() {
  const wrapper = mount(ReporteIngresosPage, { global: { provide: { [ServiciosKey as symbol]: servicios } } })
  await flushPromises()
  return wrapper
}

async function descargar(wrapper: Awaited<ReturnType<typeof montar>>, desde = '', hasta = '') {
  await wrapper.get('input[name="desde"]').setValue(desde)
  await wrapper.get('input[name="hasta"]').setValue(hasta)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('ReporteIngresosPage', () => {
  beforeEach(() => {
    descargados = []
    servicios.pagos.descargarReporte.mockReset().mockResolvedValue(new Blob(['%PDF']))
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      descargados.push(this.download)
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('sin fechas descarga todo el histórico', async () => {
    const wrapper = await montar()

    await descargar(wrapper)

    expect(servicios.pagos.descargarReporte).toHaveBeenCalledWith(undefined, undefined)
    expect(descargados).toEqual(['ingresos.pdf'])
  })

  it('con rango descarga ese período y lo pone en el nombre del archivo', async () => {
    const wrapper = await montar()

    await descargar(wrapper, '2026-11-01', '2026-11-30')

    expect(servicios.pagos.descargarReporte).toHaveBeenCalledWith('2026-11-01', '2026-11-30')
    expect(descargados).toEqual(['ingresos-2026-11-01-2026-11-30.pdf'])
  })

  it('con solo "desde", el archivo dice hasta hoy', async () => {
    const wrapper = await montar()

    await descargar(wrapper, '2026-11-01')

    expect(descargados).toEqual(['ingresos-2026-11-01-hoy.pdf'])
  })

  it('un rango invertido se marca y no descarga', async () => {
    const wrapper = await montar()

    await descargar(wrapper, '2026-11-30', '2026-11-01')

    expect(wrapper.text()).toContain('La fecha desde no puede ser posterior a la hasta.')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(servicios.pagos.descargarReporte).not.toHaveBeenCalled()
  })

  it('si el servidor falla, muestra el motivo', async () => {
    servicios.pagos.descargarReporte.mockRejectedValue(new ErrorApi(403, 'Solo el gerente puede ver reportes.'))
    const wrapper = await montar()

    await descargar(wrapper)

    expect(wrapper.text()).toContain('Solo el gerente puede ver reportes.')
    expect(descargados).toEqual([])
  })
})
