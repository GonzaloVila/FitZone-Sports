import { describe, expect, it } from 'vitest'

import { rangoDePagina, textoDeRango } from './paginacion'

describe('rangoDePagina', () => {
  it('sin resultados es 0 a 0', () => {
    expect(rangoDePagina(0, 1, 10)).toEqual({ desde: 0, hasta: 0 })
  })

  it('en la primera página arranca en 1', () => {
    expect(rangoDePagina(25, 1, 10)).toEqual({ desde: 1, hasta: 10 })
  })

  it('en una página del medio avanza de a porPagina', () => {
    expect(rangoDePagina(25, 2, 10)).toEqual({ desde: 11, hasta: 20 })
  })

  it('la última página termina en el total', () => {
    expect(rangoDePagina(25, 3, 10)).toEqual({ desde: 21, hasta: 25 })
  })
})

describe('textoDeRango', () => {
  it('muestra el rango en plural', () => {
    expect(textoDeRango(25, 2, 10, 'pago', 'pagos')).toBe('Mostrando 11 a 20 de 25 pagos')
  })

  it('con un solo resultado va en singular', () => {
    expect(textoDeRango(1, 1, 10, 'pago', 'pagos')).toBe('Mostrando 1 a 1 de 1 pago')
  })

  it('sin resultados dice solo "0 pagos"', () => {
    expect(textoDeRango(0, 1, 10, 'pago', 'pagos')).toBe('0 pagos')
  })
})
