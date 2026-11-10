import { expect, test } from '@playwright/test'
import { abrirComo, CANCHAS, fechaEnSede, monto } from './soporte'

// RN-03 · Un socio con la cuota vencida no puede reservar clases ni canchas con descuento; sí puede usar las canchas pagando
// el precio de externo. Esteban Morales es el socio en mora del seed.

test('RN-03 · el socio en mora no reserva clases y paga la cancha a precio de externo', async ({ browser }) => {
  const enMora = await abrirComo(browser, 'esteban')

  // Clase: la agenda le muestra la de Spinning (mañana, con cupo), pero al reservar se le rechaza por la cuota vencida.
  await enMora.goto('/clases')
  await enMora.getByLabel('Ver el detalle de la clase Spinning').click()
  await enMora.getByRole('button', { name: 'Reservar' }).click()
  await expect(enMora.getByText(/Tenés cuotas vencidas/).first()).toBeVisible()
  await expect(enMora.getByText('Tenés un cupo reservado')).toBeHidden()

  // Cancha: reserva igual, pero sin el 15% de socio: $16.000, el precio base de la cancha de Fútbol 5.
  await enMora.goto(`/canchas/${CANCHAS.futbol5Belgrano}/turnos?fecha=${fechaEnSede(2)}`)
  await enMora.getByRole('button', { name: 'Reservar 14:00 a 15:00' }).click()
  await enMora.getByRole('dialog', { name: 'Confirmar reserva' }).getByRole('button', { name: 'Confirmar reserva' }).click()
  await expect(enMora.getByText(/Reserva confirmada por/)).toContainText(monto(16_000))
})
