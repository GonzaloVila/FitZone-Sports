import { describe, expect, it } from 'vitest'

import { destinoDePagoDeReserva, rutasPagos } from './rutas'

function rolesDe(nombre: string): readonly string[] {
  const ruta = rutasPagos.find((candidata) => candidata.name === nombre)
  return ruta?.meta?.roles ?? []
}

describe('rutas de pagos', () => {
  it('quien reserva (SOCIO y EXTERNO) puede entrar al enlace viejo de pago', () => {
    expect(rolesDe('pagar-reserva')).toEqual(['SOCIO', 'EXTERNO'])
  })

  it('la lista de pagos y el reporte quedan para el personal', () => {
    expect(rolesDe('pagos')).toEqual(['RECEPCION', 'GERENTE'])
    expect(rolesDe('reporte-ingresos')).toEqual(['GERENTE'])
  })

  it('/pagos/nuevo es una redirección (el pago ya no es una pantalla)', () => {
    const ruta = rutasPagos.find((candidata) => candidata.path === '/pagos/nuevo')

    expect(ruta?.redirect).toBeTypeOf('function')
    expect(ruta?.component).toBeUndefined()
  })
})

describe('destinoDePagoDeReserva', () => {
  it('lleva a Mis reservas con ?pagar=<id> para abrir el modal de esa reserva', () => {
    expect(destinoDePagoDeReserva({ reservaId: '12' })).toEqual({
      name: 'canchas',
      query: { vista: 'mis-reservas', pagar: '12' },
    })
  })

  it('sin un id válido lleva solo a Mis reservas', () => {
    for (const query of [{}, { reservaId: 'abc' }, { reservaId: '0' }, { reservaId: '-4' }, { reservaId: '' }]) {
      expect(destinoDePagoDeReserva(query)).toEqual({ name: 'canchas', query: { vista: 'mis-reservas' } })
    }
  })
})
