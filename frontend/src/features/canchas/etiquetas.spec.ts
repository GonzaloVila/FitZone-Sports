import { describe, expect, it } from 'vitest'
import { armarEtiquetasCanchas, etiquetaDeCancha } from './etiquetas'

describe('armarEtiquetasCanchas', () => {
  it('liga cada id con deporte + número, como en la lista de canchas', () => {
    const etiquetas = armarEtiquetasCanchas([
      { id: 2, tipo: 'FUTBOL5' },
      { id: 7, tipo: 'PADDLE' },
    ])

    expect(etiquetas.get(2)).toBe('Fútbol 5 #2')
    expect(etiquetas.get(7)).toBe('Paddle #7')
    expect(etiquetas.size).toBe(2)
  })

  it('sin canchas queda vacío', () => {
    expect(armarEtiquetasCanchas([]).size).toBe(0)
  })
})

describe('etiquetaDeCancha', () => {
  const etiquetas = armarEtiquetasCanchas([{ id: 2, tipo: 'FUTBOL5' }])

  it('usa la etiqueta del mapa', () => {
    expect(etiquetaDeCancha(etiquetas, 2)).toBe('Fútbol 5 #2')
  })

  it('si la cancha no aparece cae a "Cancha #N"', () => {
    expect(etiquetaDeCancha(etiquetas, 9)).toBe('Cancha #9')
  })
})
