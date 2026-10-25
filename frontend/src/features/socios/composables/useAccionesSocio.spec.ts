import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'

const mocks = vi.hoisted(() => ({
  modificarMembresia: vi.fn(),
  dejarDeSerSocio: vi.fn(),
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ socios: mocks }),
}))

import { ErrorApi } from '@/compartido/http/errores'
import { useAvisosFz } from '@/ui'
import type { EstadoMembresia, Membresia } from '../services/servicioSocios'
import type { FilaSocio } from '../tipos'
import { useAccionesSocio, type ResultadoAccion } from './useAccionesSocio'

const membresia = (estado: EstadoMembresia, plan: Membresia['plan'] = 'MENSUAL'): Membresia => ({
  id: 1,
  plan,
  estado,
  fechaInicio: '2026-01-01T00:00:00-03:00',
  fechaFin: '2026-02-01T00:00:00-03:00',
  renuevaAutomatica: false,
})

function fila(id: number, estado: EstadoMembresia | null, plan: Membresia['plan'] = 'MENSUAL'): FilaSocio {
  return {
    socio: { id, usuarioId: id + 100, sedeOrigenId: 1, fechaAlta: '2026-01-01T00:00:00-03:00', nombre: 'Camila Domínguez', email: 'camila@fitzone.com' },
    membresia: estado ? { situacion: 'disponible', membresia: membresia(estado, plan) } : { situacion: 'no-disponible' },
  }
}

function diferida<T>() {
  let resolver!: (valor: T) => void
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve
  })
  return { promesa, resolver }
}

const avisos = useAvisosFz()
let scope: EffectScope
const terminadas: ResultadoAccion[] = []

function armar() {
  scope = effectScope()
  return scope.run(() => useAccionesSocio((resultado) => terminadas.push(resultado)))!
}

const titulos = () => avisos.avisos.value.map((aviso) => [aviso.titulo, aviso.descripcion])

describe('useAccionesSocio', () => {
  beforeEach(() => {
    avisos.cerrarTodos()
    terminadas.length = 0
    mocks.modificarMembresia.mockReset().mockImplementation(async (_id: number, cambios: { plan?: Membresia['plan']; estado?: EstadoMembresia }) =>
      membresia(cambios.estado ?? 'ACTIVA', cambios.plan ?? 'MENSUAL'),
    )
    mocks.dejarDeSerSocio.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => scope?.stop())

  it('abrir deja el pedido, la acción, el socio y la membresía de la fila', () => {
    const acciones = armar()
    acciones.abrir(fila(1, 'ACTIVA', 'ANUAL'), 'cambiar-plan')

    expect(acciones.accion.value).toBe('cambiar-plan')
    expect(acciones.socio.value?.nombre).toBe('Camila Domínguez')
    expect(acciones.membresia.value?.plan).toBe('ANUAL')
    expect(acciones.ejecutando.value).toBe(false)
    expect(acciones.error.value).toBeNull()
  })

  describe('cambiar plan', () => {
    it('ACTIVA: manda solo { plan }, cierra, avisa y entrega la membresía devuelta', async () => {
      const acciones = armar()
      acciones.abrir(fila(1, 'ACTIVA'), 'cambiar-plan')

      await acciones.confirmarPlan('ANUAL')

      expect(mocks.modificarMembresia).toHaveBeenCalledWith(1, { plan: 'ANUAL' })
      expect(acciones.pedido.value).toBeNull()
      expect(titulos()).toEqual([['Plan cambiado', 'Camila Domínguez ahora tiene el plan Anual.']])
      expect(terminadas).toEqual([{ socioId: 1, membresia: membresia('ACTIVA', 'ANUAL') }])
      expect(acciones.ejecutando.value).toBe(false)
    })

    it('VENCIDA: manda { plan, estado: "ACTIVA" } (renueva) y avisa que se renovó', async () => {
      const acciones = armar()
      acciones.abrir(fila(1, 'VENCIDA'), 'cambiar-plan')

      await acciones.confirmarPlan('TRIMESTRAL')

      expect(mocks.modificarMembresia).toHaveBeenCalledWith(1, { plan: 'TRIMESTRAL', estado: 'ACTIVA' })
      expect(titulos()).toEqual([['Membresía renovada', 'Camila Domínguez tiene el plan Trimestral desde hoy.']])
      expect(terminadas).toHaveLength(1)
    })

    it('VENCIDA puede renovar con el mismo plan', async () => {
      const acciones = armar()
      acciones.abrir(fila(1, 'VENCIDA', 'MENSUAL'), 'cambiar-plan')

      await acciones.confirmarPlan('MENSUAL')

      expect(mocks.modificarMembresia).toHaveBeenCalledWith(1, { plan: 'MENSUAL', estado: 'ACTIVA' })
    })

    it('ACTIVA con el mismo plan, SUSPENDIDA o sin membresía: no manda nada', async () => {
      const acciones = armar()
      for (const f of [fila(1, 'ACTIVA', 'MENSUAL'), fila(2, 'SUSPENDIDA'), fila(3, null)]) {
        acciones.abrir(f, 'cambiar-plan')
        await acciones.confirmarPlan(f.membresia.situacion === 'disponible' && f.membresia.membresia.estado === 'ACTIVA' ? 'MENSUAL' : 'ANUAL')
      }

      expect(mocks.modificarMembresia).not.toHaveBeenCalled()
      expect(acciones.pedido.value).not.toBeNull()
    })
  })

  it('suspender manda { estado: "SUSPENDIDA" } y avisa con el nombre', async () => {
    const acciones = armar()
    acciones.abrir(fila(1, 'ACTIVA'), 'suspender')

    await acciones.suspender()

    expect(mocks.modificarMembresia).toHaveBeenCalledWith(1, { estado: 'SUSPENDIDA' })
    expect(titulos()).toEqual([['Membresía suspendida', 'Camila Domínguez.']])
    expect(terminadas).toEqual([{ socioId: 1, membresia: membresia('SUSPENDIDA') }])
  })

  it('reactivar manda { estado: "ACTIVA" } y avisa con el nombre', async () => {
    const acciones = armar()
    acciones.abrir(fila(1, 'SUSPENDIDA'), 'reactivar')

    await acciones.reactivar()

    expect(mocks.modificarMembresia).toHaveBeenCalledWith(1, { estado: 'ACTIVA' })
    expect(titulos()).toEqual([['Membresía reactivada', 'Camila Domínguez.']])
  })

  it('suspender no corre si la membresía no está ACTIVA, ni reactivar si no está SUSPENDIDA', async () => {
    const acciones = armar()
    acciones.abrir(fila(1, 'VENCIDA'), 'suspender')
    await acciones.suspender()
    acciones.abrir(fila(1, 'ACTIVA'), 'reactivar')
    await acciones.reactivar()

    expect(mocks.modificarMembresia).not.toHaveBeenCalled()
  })

  it('cada función solo corre si es la acción abierta', async () => {
    const acciones = armar()
    acciones.abrir(fila(1, 'ACTIVA'), 'cambiar-plan')

    await acciones.suspender()
    await acciones.dejarDeSerSocio()

    expect(mocks.modificarMembresia).not.toHaveBeenCalled()
    expect(mocks.dejarDeSerSocio).not.toHaveBeenCalled()
  })

  it('dejar de ser socio llama a la baja, avisa y entrega { baja: true }', async () => {
    const acciones = armar()
    acciones.abrir(fila(7, 'ACTIVA'), 'dejar-de-ser-socio')

    await acciones.dejarDeSerSocio()

    expect(mocks.dejarDeSerSocio).toHaveBeenCalledWith(7)
    expect(titulos()).toEqual([['Dejó de ser socio', 'Camila Domínguez ya no es socio.']])
    expect(terminadas).toEqual([{ socioId: 7, baja: true }])
    expect(acciones.pedido.value).toBeNull()
  })

  describe('errores', () => {
    it('el modal queda abierto con el mensaje del servidor, sin aviso flotante ni resultado', async () => {
      mocks.modificarMembresia.mockRejectedValue(new ErrorApi(409, 'La membresía cambió mientras tanto.'))
      const acciones = armar()
      acciones.abrir(fila(1, 'ACTIVA'), 'suspender')

      await acciones.suspender()

      expect(acciones.pedido.value).not.toBeNull()
      expect(acciones.error.value).toBe('La membresía cambió mientras tanto.')
      expect(acciones.ejecutando.value).toBe(false)
      expect(avisos.avisos.value).toHaveLength(0)
      expect(terminadas).toHaveLength(0)
    })

    it('el 402 es el cobro rechazado, con su texto claro', async () => {
      mocks.modificarMembresia.mockRejectedValue(new ErrorApi(402, 'Payment Required'))
      const acciones = armar()
      acciones.abrir(fila(1, 'VENCIDA'), 'cambiar-plan')

      await acciones.confirmarPlan('ANUAL')

      expect(acciones.error.value).toBe('El cobro fue rechazado, no se hicieron cambios.')
      expect(acciones.pedido.value).not.toBeNull()
    })

    it('un error sin mensaje del servidor usa el texto por defecto', async () => {
      mocks.dejarDeSerSocio.mockRejectedValue(new TypeError('red'))
      const acciones = armar()
      acciones.abrir(fila(1, 'ACTIVA'), 'dejar-de-ser-socio')

      await acciones.dejarDeSerSocio()

      expect(acciones.error.value).toBe('No se pudo completar la acción.')
    })

    it('después de un error se puede reintentar, y un intento exitoso limpia el error', async () => {
      mocks.modificarMembresia.mockRejectedValueOnce(new ErrorApi(500, 'Falló'))
      const acciones = armar()
      acciones.abrir(fila(1, 'ACTIVA'), 'suspender')

      await acciones.suspender()
      expect(acciones.error.value).toBe('Falló')
      await acciones.suspender()

      expect(acciones.error.value).toBeNull()
      expect(acciones.pedido.value).toBeNull()
      expect(terminadas).toHaveLength(1)
    })

  })

  describe('concurrencia', () => {
    it('no hay doble disparo mientras una acción está en curso', async () => {
      const respuesta = diferida<Membresia>()
      mocks.modificarMembresia.mockReturnValue(respuesta.promesa)
      const acciones = armar()
      acciones.abrir(fila(1, 'ACTIVA'), 'suspender')

      const primera = acciones.suspender()
      expect(acciones.ejecutando.value).toBe(true)
      await acciones.suspender()
      respuesta.resolver(membresia('SUSPENDIDA'))
      await primera

      expect(mocks.modificarMembresia).toHaveBeenCalledTimes(1)
      expect(terminadas).toHaveLength(1)
    })

    it('si se cierra a mitad, la respuesta se descarta: no avisa ni entrega nada', async () => {
      const respuesta = diferida<Membresia>()
      mocks.modificarMembresia.mockReturnValue(respuesta.promesa)
      const acciones = armar()
      acciones.abrir(fila(1, 'ACTIVA'), 'suspender')

      const enCurso = acciones.suspender()
      acciones.cerrar()
      respuesta.resolver(membresia('SUSPENDIDA'))
      await enCurso

      expect(acciones.pedido.value).toBeNull()
      expect(acciones.ejecutando.value).toBe(false)
      expect(avisos.avisos.value).toHaveLength(0)
      expect(terminadas).toHaveLength(0)
    })

    it('si se abre otra fila a mitad, la respuesta de la anterior se descarta y no pisa el pedido nuevo', async () => {
      const respuesta = diferida<Membresia>()
      mocks.modificarMembresia.mockReturnValue(respuesta.promesa)
      const acciones = armar()
      acciones.abrir(fila(1, 'ACTIVA'), 'suspender')

      const enCurso = acciones.suspender()
      acciones.abrir(fila(2, 'ACTIVA'), 'suspender')
      respuesta.resolver(membresia('SUSPENDIDA'))
      await enCurso

      expect(acciones.socio.value?.id).toBe(2)
      expect(acciones.pedido.value).not.toBeNull()
      expect(acciones.ejecutando.value).toBe(false)
      expect(terminadas).toHaveLength(0)
    })

    it('un error que llega después de cerrar tampoco se muestra', async () => {
      let rechazar!: (e: unknown) => void
      mocks.modificarMembresia.mockReturnValue(new Promise((_, reject) => (rechazar = reject)))
      const acciones = armar()
      acciones.abrir(fila(1, 'ACTIVA'), 'suspender')

      const enCurso = acciones.suspender()
      acciones.cerrar()
      rechazar(new ErrorApi(500, 'Falló'))
      await enCurso

      expect(acciones.error.value).toBeNull()
    })
  })
})
