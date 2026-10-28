import { describe, expect, it } from 'vitest'
import {
  campoConInicioPasado,
  diaLocal,
  esperasVigentes,
  esperaVigente,
  inscriptosVigentes,
  paginar,
  reservaVigente,
} from './reglas'
import type { EstadoEspera, EstadoReservaClase } from './services/servicioClases'

// 26 de octubre de 2026, 12:30 en la hora local de quien corre el test.
const AHORA = new Date(2026, 9, 26, 12, 30).getTime()

describe('diaLocal', () => {
  it('da el día de la hora local con ceros a la izquierda', () => {
    expect(diaLocal(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05')
    expect(diaLocal(AHORA)).toBe('2026-10-26')
  })
})

describe('campoConInicioPasado', () => {
  it('un día anterior a hoy se marca en el día', () => {
    expect(campoConInicioPasado('2026-10-25', '18:00', AHORA)).toBe('dia')
    expect(campoConInicioPasado('2026-10-25', '', AHORA)).toBe('dia')
  })

  it('hoy con una hora que ya pasó se marca en la hora de inicio', () => {
    expect(campoConInicioPasado('2026-10-26', '12:00', AHORA)).toBe('horaInicio')
  })

  it('hoy con una hora que todavía no llegó, o sin hora, no se marca', () => {
    expect(campoConInicioPasado('2026-10-26', '12:31', AHORA)).toBeNull()
    expect(campoConInicioPasado('2026-10-26', '', AHORA)).toBeNull()
  })

  it('un día posterior a hoy no se marca, tenga la hora que tenga', () => {
    expect(campoConInicioPasado('2026-10-27', '00:00', AHORA)).toBeNull()
  })

  it('sin día no hay nada que comparar', () => {
    expect(campoConInicioPasado('', '08:00', AHORA)).toBeNull()
  })
})

describe('reservaVigente', () => {
  it('se queda con la confirmada aunque haya canceladas antes', () => {
    const reservas = [
      { id: 1, estado: 'CANCELADA' },
      { id: 2, estado: 'CONFIRMADA' },
    ]
    expect(reservaVigente(reservas)?.id).toBe(2)
  })

  it('sin confirmadas no hay reserva vigente', () => {
    expect(reservaVigente([{ id: 1, estado: 'CANCELADA' }])).toBeNull()
    expect(reservaVigente([])).toBeNull()
  })
})

describe('esperaVigente', () => {
  it('toma la que está en espera o notificada y no la cancelada', () => {
    expect(esperaVigente([{ id: 1, estado: 'CANCELADO' }, { id: 2, estado: 'EN_ESPERA' }])?.id).toBe(2)
    expect(esperaVigente([{ id: 1, estado: 'CANCELADO' }, { id: 3, estado: 'NOTIFICADO' }])?.id).toBe(3)
  })

  it('una confirmada ya es reserva y una cancelada no cuenta', () => {
    expect(esperaVigente([{ id: 1, estado: 'CONFIRMADO' }, { id: 2, estado: 'CANCELADO' }])).toBeNull()
  })
})

describe('esperasVigentes', () => {
  it('de la cola completa deja solo las vivas y respeta el orden', () => {
    const cola: { id: number; estado: EstadoEspera }[] = [
      { id: 1, estado: 'CANCELADO' },
      { id: 2, estado: 'EN_ESPERA' },
      { id: 3, estado: 'CONFIRMADO' },
      { id: 4, estado: 'NOTIFICADO' },
    ]
    expect(esperasVigentes(cola).map((e) => e.id)).toEqual([2, 4])
  })

  it('una cola solo de canceladas queda vacía', () => {
    expect(esperasVigentes<{ id: number; estado: EstadoEspera }>([{ id: 1, estado: 'CANCELADO' }])).toEqual([])
  })
})

describe('inscriptosVigentes', () => {
  it('descarta las canceladas y conserva las confirmadas, en el mismo orden', () => {
    const reservas: { id: number; estado: EstadoReservaClase }[] = [
      { id: 1, estado: 'CANCELADA' },
      { id: 2, estado: 'CONFIRMADA' },
      { id: 3, estado: 'CANCELADA' },
      { id: 4, estado: 'CONFIRMADA' },
    ]
    expect(inscriptosVigentes(reservas).map((r) => r.id)).toEqual([2, 4])
  })
})

describe('paginar', () => {
  const filas = Array.from({ length: 23 }, (_, i) => i + 1)

  it('devuelve la página pedida con su rango y el total', () => {
    expect(paginar(filas, 2, 10)).toEqual({
      items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      pagina: 2,
      totalPaginas: 3,
      desde: 11,
      hasta: 20,
      total: 23,
    })
  })

  it('la última página puede tener menos filas', () => {
    const pagina = paginar(filas, 3, 10)

    expect(pagina.items).toEqual([21, 22, 23])
    expect([pagina.desde, pagina.hasta]).toEqual([21, 23])
  })

  it('si la página pedida supera el total devuelve la última válida', () => {
    const pagina = paginar(filas, 9, 10)

    expect(pagina.pagina).toBe(3)
    expect(pagina.items).toEqual([21, 22, 23])
  })

  it('una página menor que 1 o inválida vale 1', () => {
    for (const invalida of [0, -2, Number.NaN]) {
      expect(paginar(filas, invalida, 10).pagina, String(invalida)).toBe(1)
    }
  })

  it('con 10 o menos filas hay una sola página', () => {
    expect(paginar(filas.slice(0, 10), 1, 10)).toMatchObject({ totalPaginas: 1, desde: 1, hasta: 10, total: 10 })
    expect(paginar(filas.slice(0, 1), 5, 10)).toMatchObject({ pagina: 1, totalPaginas: 1, desde: 1, hasta: 1, total: 1 })
  })

  it('sin filas: una página vacía, sin rango', () => {
    expect(paginar([], 3, 10)).toEqual({ items: [], pagina: 1, totalPaginas: 1, desde: 0, hasta: 0, total: 0 })
  })
})
