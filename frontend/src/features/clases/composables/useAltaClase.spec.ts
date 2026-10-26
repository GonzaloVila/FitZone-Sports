import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

const mocks = vi.hoisted(() => ({
  crear: vi.fn(),
  sedeId: { value: null as number | null },
}))

vi.mock('@/compartido/servicios', () => ({
  useServicios: () => ({ clases: { crear: mocks.crear } }),
}))

vi.mock('@/features/sesion/composables/useUsuarioSesion', () => ({
  useUsuarioSesion: () => ({ sedeId: mocks.sedeId }),
}))

import { crearErrorDeRespuesta } from '@/compartido/http/errores'
import { useAltaClase } from './useAltaClase'

const DETALLE_409 = 'No se puede programar una clase en una fecha u hora pasada.'

function armar() {
  return effectScope().run(() => useAltaClase())!
}

function completar(alta: ReturnType<typeof armar>) {
  alta.form.sedeId = '2'
  alta.form.tipo = ' Yoga '
  alta.form.instructor = 'Lucía'
  alta.form.dia = '2026-05-04'
  alta.form.horaInicio = '18:00'
  alta.form.horaFin = '19:00'
  alta.form.capacidad = '12'
}

describe('useAltaClase', () => {
  beforeEach(() => {
    mocks.crear.mockReset()
    mocks.sedeId.value = null
    // Domingo 3 de mayo de 2026, 12:00 (hora local): el día que usa `completar` (el 4) queda en el futuro.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 4, 3, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('sede por defecto', () => {
    it('el GERENTE arranca en la sede que se le pasa (la sede activa)', () => {
      const alta = armar()

      alta.reiniciar(5)

      expect(alta.form.sedeId).toBe('5')
    })

    it('sin sede activa todavía queda sin elegir', () => {
      const alta = armar()

      alta.reiniciar(null)

      expect(alta.form.sedeId).toBe('')
    })

    it('el RECEPCION queda en su sede, aunque la sede que se pase sea otra', () => {
      mocks.sedeId.value = 3
      const alta = armar()

      alta.reiniciar(9)

      expect(alta.form.sedeId).toBe('3')
    })
  })

  describe('reiniciar', () => {
    it('deja el formulario vacío y sin errores', async () => {
      const alta = armar()
      await alta.crear()
      completar(alta)
      alta.error.value = 'algo falló'

      alta.reiniciar(2)

      expect(alta.form).toMatchObject({ sedeId: '2', tipo: '', instructor: '', dia: '', horaInicio: '', horaFin: '', capacidad: '' })
      expect(alta.errores.value).toEqual({})
      expect(alta.error.value).toBeNull()
    })
  })

  describe('crear', () => {
    it('con datos incompletos marca los campos y no llama al servidor', async () => {
      const alta = armar()

      const creada = await alta.crear()

      expect(creada).toBeNull()
      expect(mocks.crear).not.toHaveBeenCalled()
      expect(Object.keys(alta.errores.value)).toEqual(
        expect.arrayContaining(['sedeId', 'tipo', 'instructor', 'dia', 'horaInicio', 'horaFin', 'capacidad']),
      )
    })

    it('la hora de fin tiene que ser posterior a la de inicio', async () => {
      const alta = armar()
      completar(alta)
      alta.form.horaFin = '17:00'

      await alta.crear()

      expect(alta.errores.value.horaFin).toMatch(/posterior/)
      expect(mocks.crear).not.toHaveBeenCalled()
    })

    it('un día que ya pasó se marca junto al día, con los demás errores, sin llamar al servidor', async () => {
      const alta = armar()
      completar(alta)
      alta.form.dia = '2026-05-02'
      alta.form.tipo = ''

      const creada = await alta.crear()

      expect(creada).toBeNull()
      expect(alta.errores.value.dia).toBe('Elegí un día y una hora que no hayan pasado.')
      expect(alta.errores.value.tipo).toBeTruthy()
      expect(mocks.crear).not.toHaveBeenCalled()
    })

    it('hoy con una hora de inicio que ya pasó se marca junto a la hora de inicio', async () => {
      const alta = armar()
      completar(alta)
      alta.form.dia = '2026-05-03'
      alta.form.horaInicio = '09:00'
      alta.form.horaFin = '10:00'

      await alta.crear()

      expect(alta.errores.value.horaInicio).toBe('Elegí un día y una hora que no hayan pasado.')
      expect(alta.errores.value.dia).toBeUndefined()
      expect(mocks.crear).not.toHaveBeenCalled()
    })

    it('hoy con una hora que todavía no llegó se envía', async () => {
      mocks.crear.mockResolvedValue({ id: 41, tipo: 'Yoga' })
      const alta = armar()
      completar(alta)
      alta.form.dia = '2026-05-03'
      alta.form.horaInicio = '18:00'

      expect(await alta.crear()).toEqual({ id: 41, tipo: 'Yoga' })
    })

    it('si el servidor responde 409 (su reloj puede diferir) lo deja junto a los campos de horario', async () => {
      mocks.crear.mockRejectedValue(crearErrorDeRespuesta(409, { title: 'Conflicto', status: 409, detail: DETALLE_409 }, 'Conflict'))
      const alta = armar()
      completar(alta)

      await alta.crear()

      expect(alta.errores.value.horario).toBe(DETALLE_409)
    })

    it('envía los horarios con el offset de la sede y devuelve la clase creada', async () => {
      mocks.crear.mockResolvedValue({ id: 40, tipo: 'Yoga' })
      const alta = armar()
      completar(alta)

      const creada = await alta.crear()

      expect(creada).toEqual({ id: 40, tipo: 'Yoga' })
      expect(mocks.crear).toHaveBeenCalledWith({
        sedeId: 2,
        tipo: 'Yoga',
        instructor: 'Lucía',
        horarioInicio: '2026-05-04T18:00:00-03:00',
        horarioFin: '2026-05-04T19:00:00-03:00',
        capacidad: 12,
      })
    })

    it('si falla devuelve null y deja el error para mostrarlo en el modal', async () => {
      mocks.crear.mockRejectedValue(new Error('sin conexión'))
      const alta = armar()
      completar(alta)

      const creada = await alta.crear()

      expect(creada).toBeNull()
      expect(alta.error.value).toBeTruthy()
      expect(alta.guardando.value).toBe(false)
    })
  })
})
