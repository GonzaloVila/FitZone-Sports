import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'

const mocks = vi.hoisted(() => ({
  socios: { obtener: vi.fn(), obtenerMembresia: vi.fn(), modificarMembresia: vi.fn(), modificar: vi.fn() },
  usuarios: { obtener: vi.fn() },
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => mocks,
}))

import { ErrorApi } from '@/compartido/http/errores'
import { useAvisosFz } from '@/ui'
import type { EstadoMembresia, Membresia, Socio } from '../services/servicioSocios'
import { useDetalleSocio } from './useDetalleSocio'

const socio: Socio = {
  id: 1,
  usuarioId: 101,
  sedeOrigenId: 1,
  fechaAlta: '2026-01-15T10:00:00-03:00',
  nombre: 'Camila Domínguez',
  email: 'camila@fitzone.com',
}

const membresia = (estado: EstadoMembresia = 'ACTIVA', renuevaAutomatica = false): Membresia => ({
  id: 1,
  plan: 'MENSUAL',
  estado,
  fechaInicio: '2026-01-15T00:00:00-03:00',
  fechaFin: '2026-02-15T00:00:00-03:00',
  renuevaAutomatica,
})

function diferida<T>() {
  let resolver!: (valor: T) => void
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve
  })
  return { promesa, resolver }
}

const avisos = useAvisosFz()
let scope: EffectScope

async function armar(id: number | null = 1) {
  scope?.stop()
  scope = effectScope()
  const detalle = scope.run(() => useDetalleSocio(ref(id)))!
  await vi.waitFor(() => expect(detalle.estado.value).not.toBe('cargando'))
  // Con el socio cargado, la membresía y el usuario llegan juntos un instante después.
  if (detalle.estado.value === 'listo') await vi.waitFor(() => expect(detalle.membresia.value.situacion).not.toBe('cargando'))
  return detalle
}

const titulos = () => avisos.avisos.value.map((aviso) => [aviso.tipo, aviso.titulo])

describe('useDetalleSocio', () => {
  beforeEach(() => {
    avisos.cerrarTodos()
    mocks.socios.obtener.mockReset().mockResolvedValue(socio)
    mocks.socios.obtenerMembresia.mockReset().mockResolvedValue(membresia())
    mocks.socios.modificarMembresia.mockReset()
    mocks.socios.modificar.mockReset()
    mocks.usuarios.obtener.mockReset().mockResolvedValue({ id: 101, dni: '30111222', telefono: '1155550000' })
  })

  afterEach(() => scope?.stop())

  describe('carga', () => {
    it('trae el socio, su membresía y su usuario', async () => {
      const detalle = await armar()

      expect(detalle.estado.value).toBe('listo')
      expect(detalle.socio.value).toEqual(socio)
      expect(detalle.membresia.value).toEqual({ situacion: 'disponible', valor: membresia() })
      expect(detalle.usuario.value).toEqual({ situacion: 'disponible', valor: { id: 101, dni: '30111222', telefono: '1155550000' } })
      expect(mocks.usuarios.obtener).toHaveBeenCalledWith(101, expect.anything())
    })

    it('si fallan la membresía o el usuario, la ficha igual carga y esos datos quedan "no-disponible"', async () => {
      mocks.socios.obtenerMembresia.mockRejectedValue(new Error('caída'))
      mocks.usuarios.obtener.mockRejectedValue(new Error('caída'))

      const detalle = await armar()

      expect(detalle.estado.value).toBe('listo')
      expect(detalle.membresia.value).toEqual({ situacion: 'no-disponible' })
      expect(detalle.usuario.value).toEqual({ situacion: 'no-disponible' })
    })

    it('un 404 es "no-existe"; otro error es "error" con su mensaje', async () => {
      mocks.socios.obtener.mockRejectedValue(new ErrorApi(404, 'No existe'))
      expect((await armar()).estado.value).toBe('no-existe')

      mocks.socios.obtener.mockRejectedValue(new ErrorApi(500, 'Falló el servidor'))
      const caido = await armar()
      expect(caido.estado.value).toBe('error')
      expect(caido.error.value).toBe('Falló el servidor')
    })

    it('un id inválido es "no-existe" sin pedir nada', async () => {
      mocks.socios.obtener.mockClear()

      expect((await armar(null)).estado.value).toBe('no-existe')
      expect(mocks.socios.obtener).not.toHaveBeenCalled()
    })
  })

  describe('reemplazarMembresia', () => {
    it('muestra la membresía recibida sin volver a pedir nada', async () => {
      const detalle = await armar()
      mocks.socios.obtenerMembresia.mockClear()

      detalle.reemplazarMembresia(membresia('SUSPENDIDA'))

      expect(detalle.membresia.value).toEqual({ situacion: 'disponible', valor: membresia('SUSPENDIDA') })
      expect(mocks.socios.obtenerMembresia).not.toHaveBeenCalled()
    })

    it('si el socio no cargó, no hace nada', async () => {
      mocks.socios.obtener.mockRejectedValue(new ErrorApi(404, 'No existe'))
      const detalle = await armar()

      detalle.reemplazarMembresia(membresia())

      expect(detalle.membresia.value.situacion).not.toBe('disponible')
    })
  })

  describe('alternarRenovacion', () => {
    it('pide lo contrario de lo actual, actualiza la membresía y no avisa', async () => {
      mocks.socios.modificarMembresia.mockResolvedValue(membresia('ACTIVA', true))
      const detalle = await armar()

      expect(await detalle.alternarRenovacion()).toBe(true)

      expect(mocks.socios.modificarMembresia).toHaveBeenCalledWith(1, { renuevaAutomatica: true })
      expect(detalle.membresia.value).toEqual({ situacion: 'disponible', valor: membresia('ACTIVA', true) })
      expect(detalle.ejecutando.value).toBeNull()
      expect(titulos()).toEqual([])
    })

    it('mientras guarda queda en curso y ignora otro pedido', async () => {
      const guardado = diferida<Membresia>()
      mocks.socios.modificarMembresia.mockReturnValue(guardado.promesa)
      const detalle = await armar()

      const primera = detalle.alternarRenovacion()
      expect(detalle.ejecutando.value).toBe('renovacion-automatica')
      expect(await detalle.alternarRenovacion()).toBe(false)
      guardado.resolver(membresia('ACTIVA', true))
      await primera

      expect(mocks.socios.modificarMembresia).toHaveBeenCalledTimes(1)
      expect(detalle.ejecutando.value).toBeNull()
    })

    it('si falla, la membresía no cambia y sale un aviso flotante de error (no queda error de modal)', async () => {
      mocks.socios.modificarMembresia.mockRejectedValue(new ErrorApi(409, 'Conflicto al guardar'))
      const detalle = await armar()

      expect(await detalle.alternarRenovacion()).toBe(false)

      expect(detalle.membresia.value).toEqual({ situacion: 'disponible', valor: membresia() })
      expect(titulos()).toEqual([['error', 'Conflicto al guardar']])
      expect(detalle.errorAccion.value).toBeNull()
      expect(detalle.ejecutando.value).toBeNull()
    })

    it('sin membresía disponible no pide nada', async () => {
      mocks.socios.obtenerMembresia.mockRejectedValue(new Error('caída'))
      const detalle = await armar()

      expect(await detalle.alternarRenovacion()).toBe(false)
      expect(mocks.socios.modificarMembresia).not.toHaveBeenCalled()
    })
  })

  describe('cambiarSede', () => {
    it('guarda la sede, muestra el socio actualizado y avisa con un aviso flotante de éxito', async () => {
      mocks.socios.modificar.mockResolvedValue({ ...socio, sedeOrigenId: 2 })
      const detalle = await armar()

      expect(await detalle.cambiarSede(2)).toBe(true)

      expect(mocks.socios.modificar).toHaveBeenCalledWith(1, { sedeOrigenId: 2 })
      expect(detalle.socio.value?.sedeOrigenId).toBe(2)
      expect(titulos()).toEqual([['exito', 'Se cambió la sede de origen.']])
    })

    it('si falla, deja el error para el modal (sin aviso flotante) y se limpia con limpiarErrorAccion', async () => {
      mocks.socios.modificar.mockRejectedValue(new ErrorApi(409, 'La sede no admite más socios'))
      const detalle = await armar()

      expect(await detalle.cambiarSede(2)).toBe(false)

      expect(detalle.errorAccion.value).toBe('La sede no admite más socios')
      expect(detalle.socio.value?.sedeOrigenId).toBe(1)
      expect(titulos()).toEqual([])

      detalle.limpiarErrorAccion()
      expect(detalle.errorAccion.value).toBeNull()
    })

    it('un error sin mensaje del contrato usa el texto por defecto', async () => {
      mocks.socios.modificar.mockRejectedValue(new Error('caída'))
      const detalle = await armar()

      await detalle.cambiarSede(2)

      expect(detalle.errorAccion.value).toBe('No se pudo completar la acción.')
    })
  })
})
