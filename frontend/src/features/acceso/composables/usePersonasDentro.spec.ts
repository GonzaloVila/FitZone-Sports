import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref, type Ref } from 'vue'
import { ErrorApi } from '@/compartido/http/errores'
import { ServiciosKey, type Servicios } from '@/compartido/servicios'
import { TIPOS_ERROR_ACCESO } from '../tipos'
import { usePersonasDentro } from './usePersonasDentro'

// RF-05: quién está dentro de la sede y el registro de su egreso.
const ingreso = (id: number) => ({ id, socioId: id + 100, nombre: `Socio ${id}`, sedeId: 3, fechaHoraIngreso: '2026-11-10T12:00:00Z' })

function montar(sedeId: Ref<number | null>, opciones: { alModificar?: () => void } = {}) {
  const acceso = {
    listarIngresos: vi.fn().mockResolvedValue({ items: [ingreso(1), ingreso(2)], total: 2 }),
    registrarEgreso: vi.fn().mockResolvedValue(undefined),
  }
  let api!: ReturnType<typeof usePersonasDentro>
  mount(
    defineComponent({
      setup() {
        api = usePersonasDentro(sedeId, opciones)
        return {}
      },
      template: '<div />',
    }),
    { global: { provide: { [ServiciosKey as symbol]: { acceso } as unknown as Servicios } } },
  )
  return { api, acceso }
}

const problema = (status: number, type: string) =>
  new ErrorApi(status, 'x', { type, title: 'x', status, detail: '' })

describe('usePersonasDentro', () => {
  it('lista a los que están dentro de la sede (dentro=true, hasta 100)', async () => {
    const { api, acceso } = montar(ref(3))
    await flushPromises()

    expect(acceso.listarIngresos).toHaveBeenCalledWith({ sedeId: 3, dentro: true, perPage: 100 }, expect.any(AbortSignal))
    expect(api.personas.value.map((p) => p.id)).toEqual([1, 2])
    expect(api.cantidadDentro.value).toBe(2)
  })

  it('sin sede la lista queda vacía y no consulta', async () => {
    const { api, acceso } = montar(ref(null))
    await flushPromises()

    expect(acceso.listarIngresos).not.toHaveBeenCalled()
    expect(api.personas.value).toEqual([])
  })

  it('al pasar a "sin sede" vacía la lista', async () => {
    const sede = ref<number | null>(3)
    const { api } = montar(sede)
    await flushPromises()

    sede.value = null
    await flushPromises()

    expect(api.personas.value).toEqual([])
  })

  it('un error de carga se informa', async () => {
    const sede = ref<number | null>(3)
    const { api, acceso } = montar(sede)
    await flushPromises()
    acceso.listarIngresos.mockRejectedValue(new Error('caído'))

    await api.recargar()

    expect(api.error.value).toBe('No se pudo cargar la lista de personas dentro de la sede.')
    expect(api.cargando.value).toBe(false)
  })

  describe('registrarEgreso', () => {
    it('saca a la persona de la lista, avisa y notifica el cambio (para refrescar el aforo)', async () => {
      const alModificar = vi.fn()
      const { api, acceso } = montar(ref(3), { alModificar })
      await flushPromises()

      await api.registrarEgreso(1)

      expect(acceso.registrarEgreso).toHaveBeenCalledWith(1)
      expect(api.personas.value.map((p) => p.id)).toEqual([2])
      expect(api.mensajeAccion.value).toEqual({ tipo: 'exito', texto: 'Egreso registrado correctamente.' })
      expect(alModificar).toHaveBeenCalledTimes(1)
      expect(api.egresandoId.value).toBeNull()
    })

    it('si otra terminal ya lo registró (409), avisa y recarga la lista', async () => {
      const alModificar = vi.fn()
      const { api, acceso } = montar(ref(3), { alModificar })
      await flushPromises()
      acceso.registrarEgreso.mockRejectedValue(problema(409, TIPOS_ERROR_ACCESO.EGRESO_DUPLICADO))
      acceso.listarIngresos.mockResolvedValue({ items: [ingreso(2)], total: 1 })

      await api.registrarEgreso(1)

      expect(api.mensajeAccion.value?.tipo).toBe('aviso')
      expect(api.personas.value.map((p) => p.id)).toEqual([2])
      expect(alModificar).toHaveBeenCalledTimes(1)
    })

    it('cualquier otro error se muestra y la lista no cambia', async () => {
      const { api, acceso } = montar(ref(3))
      await flushPromises()
      acceso.registrarEgreso.mockRejectedValue(problema(422, TIPOS_ERROR_ACCESO.EGRESO_FUERA_DE_SEDE))

      await api.registrarEgreso(1)

      expect(api.mensajeAccion.value).toEqual({ tipo: 'error', texto: 'x' })
      expect(api.personas.value).toHaveLength(2)
      expect(api.egresandoId.value).toBeNull()
    })
  })
})
