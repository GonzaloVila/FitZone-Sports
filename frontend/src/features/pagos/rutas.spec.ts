import { describe, expect, it } from 'vitest'

import { rutasPagos } from './rutas'

function rolesDe(nombre: string): readonly string[] {
  const ruta = rutasPagos.find((candidata) => candidata.name === nombre)
  return ruta?.meta?.roles ?? []
}

describe('rutas de pagos', () => {
  it('el EXTERNO puede pagar su reserva', () => {
    expect(rolesDe('pagar-reserva')).toContain('EXTERNO')
  })

  it('la lista de pagos y el reporte quedan para el personal', () => {
    expect(rolesDe('pagos')).toEqual(['RECEPCION', 'GERENTE'])
    expect(rolesDe('reporte-ingresos')).toEqual(['GERENTE'])
  })
})
