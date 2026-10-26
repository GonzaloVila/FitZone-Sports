import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'

const mocks = vi.hoisted(() => ({
  crear: vi.fn(),
  listarTodosPorRol: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ usuarios: mocks }),
}))

import { ErrorApi } from '@/compartido/http/errores'
import type { Sede } from '@/features/sedes/services/servicioSedes'
import type { Usuario } from '../services/servicioUsuarios'
import { useAltaStaff } from './useAltaStaff'

const sede = (id: number): Sede => ({ id, nombre: `Sede ${id}`, direccion: '', aforoMaximo: 100 })

const usuario = (parcial: Partial<Usuario> = {}): Usuario => ({
  id: 10,
  rol: 'RECEPCION',
  dni: '35123456',
  nombre: 'Ana Gómez',
  email: 'ana@fitzone.com.ar',
  ...parcial,
})

const errorApi = (status: number, detail: string) =>
  new ErrorApi(status, detail, { type: 'about:blank', title: 'Error', status, detail })

let scope: EffectScope

function armar() {
  scope = effectScope()
  const sedes = ref<Sede[]>([sede(1), sede(2), sede(3)])
  const alta = scope.run(() => useAltaStaff(sedes))!
  return { alta, sedes }
}

function completar(alta: ReturnType<typeof armar>['alta']) {
  alta.datos.nombre = '  Ana Gómez  '
  alta.datos.dni = ' 35123456 '
  alta.datos.email = ' ana@fitzone.com.ar '
  alta.datos.telefono = ' +54 351 555-1234 '
  alta.datos.contrasenia = 'Clave-Segura-123'
  alta.datos.sedeId = '1'
}

describe('useAltaStaff', () => {
  beforeEach(() => {
    mocks.crear.mockReset()
    mocks.listarTodosPorRol.mockReset().mockResolvedValue([])
  })

  afterEach(() => {
    scope?.stop()
  })

  it('al pedir las sedes, solo deja las libres y limpia la ocupada', async () => {
    const { alta } = armar()

    mocks.listarTodosPorRol.mockResolvedValue([usuario({ sedeId: 2 }), usuario({ id: 11, sedeId: null })])
    alta.datos.sedeId = '2'
    await alta.cargarSedesOcupadas()
    await flushPromises()

    expect(alta.sedesDisponibles.value.map((s) => s.id)).toEqual([1, 3])
    expect(alta.datos.sedeId).toBe('')
  })

  it('crea un recepcionista con la sede numérica y los textos recortados', async () => {
    const { alta } = armar()
    completar(alta)
    const creado = usuario({ sedeId: 1 })
    mocks.crear.mockResolvedValue(creado)

    const resultado = await alta.crear()

    expect(mocks.crear).toHaveBeenCalledWith({
      rol: 'RECEPCION',
      nombre: 'Ana Gómez',
      dni: '35123456',
      email: 'ana@fitzone.com.ar',
      telefono: '+54 351 555-1234',
      contrasenia: 'Clave-Segura-123',
      sedeId: 1,
    })
    expect(resultado).toEqual(creado)
    // La contraseña no queda en memoria después del envío.
    expect(alta.datos.contrasenia).toBe('')
  })

  it('no llama al servicio si falta la sede', async () => {
    const { alta } = armar()
    completar(alta)
    alta.datos.sedeId = ''

    expect(await alta.crear()).toBeNull()
    expect(mocks.crear).not.toHaveBeenCalled()
    expect(alta.errores.value.sedeId).toBe('Elegí la sede de trabajo.')
  })

  it('mapea el 409 de sede ocupada al campo y conserva lo cargado', async () => {
    const { alta } = armar()
    completar(alta)
    mocks.crear.mockRejectedValue(errorApi(409, 'La sede 1 ya tiene una recepcionista asignada.'))

    expect(await alta.crear()).toBeNull()
    await flushPromises()

    expect(alta.errores.value.sedeId).toBe('La sede 1 ya tiene una recepcionista asignada.')
    expect(alta.errorGeneral.value).toBeNull()
    expect(alta.datos.sedeId).toBe('1')
  })

  it('un 422 de validación se muestra en el campo y no borra lo cargado', async () => {
    const { alta } = armar()
    completar(alta)
    mocks.crear.mockRejectedValue(
      new ErrorApi(422, 'Datos inválidos', {
        type: 'about:blank',
        title: 'Datos inválidos',
        status: 422,
        detail: 'Datos inválidos',
        errors: ['email must be an email'],
      }),
    )

    await alta.crear()

    expect(alta.errores.value.email).toBe('email must be an email')
    expect(alta.datos.nombre).toBe('  Ana Gómez  ')
  })

  it('reiniciar limpia datos, errores y contraseña', async () => {
    const { alta } = armar()
    completar(alta)
    mocks.crear.mockRejectedValue(errorApi(409, 'Ya existe un usuario con el email ana@fitzone.com.ar'))
    await alta.crear()

    alta.reiniciar()

    expect(alta.datos).toEqual({
      nombre: '',
      dni: '',
      email: '',
      telefono: '',
      contrasenia: '',
      sedeId: '',
    })
    expect(alta.errores.value).toEqual({})
    expect(alta.errorGeneral.value).toBeNull()
  })
})
