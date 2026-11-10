import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { ServiciosKey, type Servicios } from '@/compartido/servicios'
import { ErrorApi } from '@/compartido/http/errores'
import { useRegistroIngreso } from './useRegistroIngreso'

// RF-04 / RNF-01: registrar un ingreso en el puesto de control, con conexión y sin ella. Sin conexión, el socio que esté
// en la lista local de inhabilitados se rechaza en el momento y no se encola.
const INGRESO = { id: 40, socioId: 12, nombre: 'Ana Socia', sedeId: 1, fechaHoraIngreso: '2026-11-09T12:00:00Z' }

function montar(registrarIngreso = vi.fn().mockResolvedValue(INGRESO)) {
  let api!: ReturnType<typeof useRegistroIngreso>
  const Prueba = defineComponent({
    setup() {
      api = useRegistroIngreso(ref(1))
      return {}
    },
    template: '<div />',
  })
  mount(Prueba, {
    global: { provide: { [ServiciosKey as symbol]: { acceso: { registrarIngreso } } as unknown as Servicios } },
  })
  api.socioIdInput.value = '12'
  api.codigoTotpInput.value = '123456'
  return { api, registrarIngreso }
}

const VENCIDA = { motivo: 'VENCIDA' as const, desde: '2026-11-01T15:00:00Z' }

describe('useRegistroIngreso', () => {
  afterEach(() => vi.restoreAllMocks())

  it('con conexión registra el ingreso y avisa', async () => {
    const { api, registrarIngreso } = montar()
    const alExito = vi.fn()

    await api.registrar({ alExito, enLinea: true })

    expect(registrarIngreso).toHaveBeenCalledWith({ sedeId: 1, socioId: 12, codigoTotp: '123456' })
    expect(api.resultado.value).toMatchObject({ tipo: 'exito', mensaje: 'Registramos el ingreso de Ana Socia.' })
    expect(alExito).toHaveBeenCalledWith(INGRESO)
    // El código TOTP se borra del formulario siempre.
    expect(api.codigoTotpInput.value).toBe('')
  })

  it('con datos inválidos no llama a la API y marca los campos', async () => {
    const { api, registrarIngreso } = montar()
    api.socioIdInput.value = ''

    await api.registrar()

    expect(registrarIngreso).not.toHaveBeenCalled()
    expect(api.errores.value.socioId).toBeDefined()
  })

  it.each([
    [403, 'membresia_inactiva'],
    [422, 'error_validacion'],
    [500, 'error_general'],
  ])('un %i del servidor se muestra como %s', async (status, tipo) => {
    const { api } = montar(vi.fn().mockRejectedValue(new ErrorApi(status, 'x')))

    await api.registrar({ enLinea: true })

    expect(api.resultado.value?.tipo).toBe(tipo)
  })

  describe('sin conexión', () => {
    it('encola el ingreso sin llamar a la API', async () => {
      const { api, registrarIngreso } = montar()
      const alEncolarOffline = vi.fn()

      await api.registrar({ enLinea: false, alEncolarOffline, bloqueoOffline: () => null })

      expect(registrarIngreso).not.toHaveBeenCalled()
      expect(alEncolarOffline).toHaveBeenCalledWith({ socioId: 12, codigoTotp: '123456' })
      expect(api.resultado.value?.tipo).toBe('offline')
    })

    it('un socio de la lista de inhabilitados se rechaza en el momento y no se encola', async () => {
      const { api, registrarIngreso } = montar()
      const alEncolarOffline = vi.fn()
      const bloqueoOffline = vi.fn().mockReturnValue(VENCIDA)

      await api.registrar({ enLinea: false, alEncolarOffline, bloqueoOffline })

      expect(bloqueoOffline).toHaveBeenCalledWith(12)
      expect(alEncolarOffline).not.toHaveBeenCalled()
      expect(registrarIngreso).not.toHaveBeenCalled()
      expect(api.resultado.value).toMatchObject({
        tipo: 'membresia_inactiva',
        mensaje: 'La membresía no está vigente o está suspendida.',
      })
      expect(api.resultado.value?.detalle).toContain('vencida desde el')
      expect(api.procesando.value).toBe(false)
    })

    it('también detecta la falta de red por navigator.onLine', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      const { api, registrarIngreso } = montar()
      const alEncolarOffline = vi.fn()

      await api.registrar({ alEncolarOffline, bloqueoOffline: () => ({ motivo: 'SUSPENDIDA', desde: '2026-11-01T15:00:00Z' }) })

      expect(registrarIngreso).not.toHaveBeenCalled()
      expect(alEncolarOffline).not.toHaveBeenCalled()
      expect(api.resultado.value?.detalle).toContain('suspendida')
    })

    it('si la red se cae en plena llamada, encola salvo que el socio esté inhabilitado', async () => {
      const caida = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      const alEncolarOffline = vi.fn()

      const libre = montar(caida)
      await libre.api.registrar({ enLinea: true, alEncolarOffline, bloqueoOffline: () => null })
      expect(libre.api.resultado.value?.tipo).toBe('offline')
      expect(alEncolarOffline).toHaveBeenCalledTimes(1)

      const bloqueado = montar(caida)
      await bloqueado.api.registrar({ enLinea: true, alEncolarOffline, bloqueoOffline: () => VENCIDA })
      expect(bloqueado.api.resultado.value?.tipo).toBe('membresia_inactiva')
      expect(alEncolarOffline).toHaveBeenCalledTimes(1)
    })

    it('sin cola offline, una caída de red se muestra como error', async () => {
      const { api } = montar(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

      await api.registrar({ enLinea: true })

      expect(api.resultado.value?.tipo).toBe('error_general')
    })
  })
})
