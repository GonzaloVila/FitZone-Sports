import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'

const mocks = vi.hoisted(() => ({
  socios: { obtener: vi.fn(), obtenerMembresia: vi.fn(), modificarMembresia: vi.fn(), modificar: vi.fn() },
  usuarios: { obtener: vi.fn(), modificar: vi.fn() },
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => mocks,
}))

import { ErrorApi, type Problema } from '@/compartido/http/errores'
import { useAvisosFz } from '@/ui'
import type { Membresia, Socio } from '../services/servicioSocios'
import { useDetalleSocio } from './useDetalleSocio'

const socio: Socio = {
  id: 1,
  usuarioId: 101,
  sedeOrigenId: 1,
  fechaAlta: '2026-01-15T10:00:00-03:00',
  nombre: 'Camila Domínguez',
  email: 'camila@fitzone.com',
}

const usuario = { id: 101, rol: 'SOCIO', dni: '30111222', nombre: 'Camila Domínguez', email: 'camila@fitzone.com', telefono: '1155550000' }

const membresia: Membresia = {
  id: 1,
  plan: 'MENSUAL',
  estado: 'ACTIVA',
  fechaInicio: '2026-01-15T00:00:00-03:00',
  fechaFin: '2026-02-15T00:00:00-03:00',
  renuevaAutomatica: false,
}

function diferida<T>() {
  let resolver!: (valor: T) => void
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve
  })
  return { promesa, resolver }
}

function error422(errors: string[]) {
  return new ErrorApi(422, 'Datos inválidos', { title: 'Unprocessable', status: 422, detail: 'Datos inválidos', errors } as Problema)
}

const avisos = useAvisosFz()
let scope: EffectScope

async function armar() {
  scope?.stop()
  scope = effectScope()
  const detalle = scope.run(() => useDetalleSocio(ref(1)))!
  await vi.waitFor(() => expect(detalle.usuario.value.situacion).toBe('disponible'))
  return detalle
}

const titulos = () => avisos.avisos.value.map((aviso) => [aviso.tipo, aviso.titulo])

describe('useDetalleSocio: editarDatos', () => {
  beforeEach(() => {
    avisos.cerrarTodos()
    mocks.socios.obtener.mockReset().mockResolvedValue(socio)
    mocks.socios.obtenerMembresia.mockReset().mockResolvedValue(membresia)
    mocks.usuarios.obtener.mockReset().mockResolvedValue(usuario)
    mocks.usuarios.modificar.mockReset().mockImplementation(async (_id: number, cambios: object) => ({ ...usuario, ...cambios }))
  })

  afterEach(() => scope?.stop())

  it('manda los cambios al usuario del socio, vuelve a pedir el socio y muestra los datos nuevos sin recargar', async () => {
    const detalle = await armar()
    mocks.socios.obtener.mockClear()
    mocks.socios.obtener.mockResolvedValue({ ...socio, nombre: 'Camila D. Pérez' })

    const salio = await detalle.editarDatos({ nombre: 'Camila D. Pérez', telefono: '1166667777' })

    expect(salio).toBe(true)
    expect(mocks.usuarios.modificar).toHaveBeenCalledWith(101, { nombre: 'Camila D. Pérez', telefono: '1166667777' })
    expect(mocks.socios.obtener).toHaveBeenCalledTimes(1)
    expect(detalle.socio.value?.nombre).toBe('Camila D. Pérez')
    expect(detalle.usuario.value).toMatchObject({ situacion: 'disponible', valor: { telefono: '1166667777' } })
    expect(detalle.estado.value).toBe('listo')
    expect(detalle.membresia.value.situacion).toBe('disponible')
  })

  it('avisa con "Datos actualizados" (aviso flotante) y no deja errores', async () => {
    const detalle = await armar()

    await detalle.editarDatos({ telefono: null })

    expect(titulos()).toEqual([['exito', 'Datos actualizados']])
    expect(detalle.errorAccion.value).toBeNull()
    expect(detalle.erroresCampos.value).toEqual({})
    expect(detalle.ejecutando.value).toBeNull()
  })

  it('un teléfono vaciado se manda como null y la ficha queda sin teléfono', async () => {
    const detalle = await armar()

    await detalle.editarDatos({ telefono: null })

    expect(mocks.usuarios.modificar).toHaveBeenCalledWith(101, { telefono: null })
    expect(detalle.usuario.value).toMatchObject({ valor: { telefono: null } })
  })

  it('mientras guarda queda en curso y no lanza un segundo pedido', async () => {
    const guardado = diferida<typeof usuario>()
    mocks.usuarios.modificar.mockReturnValue(guardado.promesa)
    const detalle = await armar()

    const primera = detalle.editarDatos({ nombre: 'Cami' })
    expect(detalle.ejecutando.value).toBe('editar-datos')
    expect(await detalle.editarDatos({ nombre: 'Otra' })).toBe(false)
    guardado.resolver({ ...usuario, nombre: 'Cami' })
    await primera

    expect(mocks.usuarios.modificar).toHaveBeenCalledTimes(1)
    expect(detalle.ejecutando.value).toBeNull()
  })

  it('si el servidor guardó pero falla la nueva consulta del socio, muestra el nombre que devolvió el usuario', async () => {
    mocks.usuarios.modificar.mockResolvedValue({ ...usuario, nombre: 'Cami Pérez' })
    const detalle = await armar()
    mocks.socios.obtener.mockRejectedValue(new Error('caída'))

    const salio = await detalle.editarDatos({ nombre: 'Cami Pérez' })

    expect(salio).toBe(true)
    expect(detalle.socio.value).toEqual({ ...socio, nombre: 'Cami Pérez' })
    expect(detalle.errorAccion.value).toBeNull()
  })

  it('un 422 queda por campo (y el resto como error general); no hay aviso flotante y la ficha no cambia', async () => {
    mocks.usuarios.modificar.mockRejectedValue(error422(['nombre must not be blank', 'fotoUrl is invalid']))
    const detalle = await armar()

    expect(await detalle.editarDatos({ nombre: '' })).toBe(false)

    expect(detalle.erroresCampos.value).toEqual({ nombre: 'nombre must not be blank' })
    expect(detalle.errorAccion.value).toBe('fotoUrl is invalid')
    expect(titulos()).toEqual([])
    expect(detalle.socio.value?.nombre).toBe('Camila Domínguez')
    expect(detalle.ejecutando.value).toBeNull()
  })

  it('un error general (con mensaje del contrato o sin él) queda en errorAccion, nunca como aviso flotante', async () => {
    mocks.usuarios.modificar.mockRejectedValue(new ErrorApi(404, 'No existe el usuario'))
    const detalle = await armar()
    await detalle.editarDatos({ nombre: 'Cami' })
    expect(detalle.errorAccion.value).toBe('No existe el usuario')
    expect(detalle.erroresCampos.value).toEqual({})

    mocks.usuarios.modificar.mockRejectedValue(new Error('caída'))
    await detalle.editarDatos({ nombre: 'Cami' })
    expect(detalle.errorAccion.value).toBe('No se pudieron guardar los datos.')
    expect(titulos()).toEqual([])
  })

  it('un reintento limpia los errores anteriores, y limpiarErrorAccion los borra', async () => {
    mocks.usuarios.modificar.mockRejectedValueOnce(error422(['nombre must not be blank']))
    const detalle = await armar()
    await detalle.editarDatos({ nombre: '' })
    expect(detalle.erroresCampos.value).toEqual({ nombre: 'nombre must not be blank' })

    await detalle.editarDatos({ nombre: 'Cami' })
    expect(detalle.erroresCampos.value).toEqual({})
    expect(detalle.errorAccion.value).toBeNull()

    mocks.usuarios.modificar.mockRejectedValueOnce(error422(['telefono is too long']))
    await detalle.editarDatos({ telefono: 'x' })
    detalle.limpiarErrorAccion()
    expect(detalle.erroresCampos.value).toEqual({})
    expect(detalle.errorAccion.value).toBeNull()
  })
})
