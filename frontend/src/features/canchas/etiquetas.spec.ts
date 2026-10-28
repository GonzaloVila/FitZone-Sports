import { describe, expect, it } from 'vitest'
import { armarDatosDeCanchas, etiquetaDeCancha, sedeDeCancha } from './etiquetas'

const CANCHAS = [
  { id: 2, tipo: 'FUTBOL5' as const, sedeId: 1 },
  { id: 7, tipo: 'PADDLE' as const, sedeId: 3 },
]

describe('armarDatosDeCanchas', () => {
  it('liga cada id con su etiqueta (deporte + número, como en la lista de canchas) y su sede', () => {
    const datos = armarDatosDeCanchas(CANCHAS)

    expect(datos.get(2)).toEqual({ etiqueta: 'Fútbol 5 #2', sedeId: 1 })
    expect(datos.get(7)).toEqual({ etiqueta: 'Paddle #7', sedeId: 3 })
    expect(datos.size).toBe(2)
  })

  it('sin canchas queda vacío', () => {
    expect(armarDatosDeCanchas([]).size).toBe(0)
  })
})

describe('etiquetaDeCancha', () => {
  const datos = armarDatosDeCanchas(CANCHAS)

  it('usa la etiqueta del mapa', () => {
    expect(etiquetaDeCancha(datos, 2)).toBe('Fútbol 5 #2')
  })

  it('si la cancha no aparece cae a "Cancha #N"', () => {
    expect(etiquetaDeCancha(datos, 9)).toBe('Cancha #9')
  })
})

describe('sedeDeCancha', () => {
  const datos = armarDatosDeCanchas(CANCHAS)

  it('devuelve la sede de la cancha', () => {
    expect(sedeDeCancha(datos, 7)).toBe(3)
  })

  it('si la cancha no aparece no sabe cuál es', () => {
    expect(sedeDeCancha(datos, 9)).toBeNull()
  })
})
