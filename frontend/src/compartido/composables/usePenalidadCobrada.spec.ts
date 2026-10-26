import { beforeEach, describe, expect, it } from 'vitest'
import { limpiarPenalidadCobrada, usePenalidadCobrada } from './usePenalidadCobrada'

describe('usePenalidadCobrada', () => {
  beforeEach(() => {
    limpiarPenalidadCobrada()
  })

  it('arranca sin penalidad', () => {
    expect(usePenalidadCobrada().penalidad.value).toBeNull()
  })

  it('guarda el pago y el monto, y lo ve cualquier otro uso (otra pantalla)', () => {
    usePenalidadCobrada().registrar({ id: 99, monto: 5000 })

    expect(usePenalidadCobrada().penalidad.value).toEqual({ pagoId: 99, monto: 5000, clase: null })
  })

  it('guarda también la clase cancelada cuando se la conoce', () => {
    const clase = { id: 7, tipo: 'Spinning', horario: 'viernes, 24/10, 18:00 a 19:00 hs' }

    usePenalidadCobrada().registrar({ id: 99, monto: 5000 }, clase)

    expect(usePenalidadCobrada().penalidad.value).toEqual({ pagoId: 99, monto: 5000, clase })
  })

  it('una penalidad nueva reemplaza a la anterior', () => {
    const { registrar, penalidad } = usePenalidadCobrada()

    registrar({ id: 1, monto: 100 }, { id: 7, tipo: 'Yoga', horario: 'lunes' })
    registrar({ id: 2, monto: 250 })

    expect(penalidad.value).toEqual({ pagoId: 2, monto: 250, clase: null })
  })

  it('al cerrarla se borra para todos', () => {
    const uno = usePenalidadCobrada()
    const otro = usePenalidadCobrada()
    uno.registrar({ id: 3, monto: 700 })

    otro.cerrar()

    expect(uno.penalidad.value).toBeNull()
  })

  it('limpiarPenalidadCobrada (cierre de sesión) la borra', () => {
    const { registrar, penalidad } = usePenalidadCobrada()
    registrar({ id: 4, monto: 800 })

    limpiarPenalidadCobrada()

    expect(penalidad.value).toBeNull()
  })
})
