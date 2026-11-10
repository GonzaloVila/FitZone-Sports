import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { abrirComo, CANCHAS, fechaEnSede, monto } from './soporte'

// Módulo 5 · Pagos: RF-13 y RF-14. La externa reserva un turno de Paddle ($8.500, fuera del horario pico) y lo paga desde
// el aviso de la reserva.

async function reservarPaddle(page: Page, hora: string) {
  const fin = `${String(Number(hora.slice(0, 2)) + 1).padStart(2, '0')}:00`
  await page.goto(`/canchas/${CANCHAS.paddleBelgrano}/turnos?fecha=${fechaEnSede(4)}`)
  await page.getByRole('button', { name: `Reservar ${hora} a ${fin}` }).click()
  await page.getByRole('dialog', { name: 'Confirmar reserva' }).getByRole('button', { name: 'Confirmar reserva' }).click()
  await expect(page.getByText(/Reserva confirmada por/)).toContainText(monto(8_500))
}

async function pagar(page: Page, medio: 'Tarjeta aprobada (demo)' | 'Tarjeta rechazada (demo)') {
  await page.getByRole('button', { name: 'Pagar ahora' }).click()
  const modal = page.getByRole('dialog', { name: 'Pagar reserva' })
  await modal.getByLabel('Medio de pago').selectOption({ label: medio })
  await modal.getByRole('button', { name: 'Pagar', exact: true }).click()
  return modal
}

test('RF-13 · pasarela simulada: una tarjeta rechazada no cobra y el reintento con una aprobada deja la reserva pagada', async ({
  browser,
}) => {
  const externa = await abrirComo(browser, 'sofia')
  await reservarPaddle(externa, '09:00')

  // La pasarela rechaza la tarjeta: el modal sigue abierto con el aviso y permite reintentar con otro medio.
  const modal = await pagar(externa, 'Tarjeta rechazada (demo)')
  await expect(modal.getByText('El pago fue rechazado.')).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Descargar comprobante' })).toBeHidden()

  await modal.getByLabel('Medio de pago').selectOption({ label: 'Tarjeta aprobada (demo)' })
  await modal.getByRole('button', { name: 'Pagar', exact: true }).click()
  await expect(modal.getByText(/Pago aprobado por/)).toContainText(monto(8_500))
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await expect(externa.getByText(/Reserva confirmada y pagada por/)).toContainText(monto(8_500))
})

test('RF-14 · al pagar se genera el comprobante en PDF y se descarga; el pago queda en "Mis pagos"', async ({ browser }) => {
  const externa = await abrirComo(browser, 'sofia')
  await reservarPaddle(externa, '11:00')
  const modal = await pagar(externa, 'Tarjeta aprobada (demo)')
  await expect(modal.getByText(/Pago aprobado por/)).toBeVisible()

  const [descarga] = await Promise.all([
    externa.waitForEvent('download'),
    modal.getByRole('button', { name: 'Descargar comprobante' }).click(),
  ])
  expect(descarga.suggestedFilename()).toMatch(/^comprobante-\d+\.pdf$/)
  const contenido = await readFile((await descarga.path())!)
  expect(contenido.subarray(0, 5).toString()).toBe('%PDF-')
  expect(contenido.length).toBeGreaterThan(1000)

  await modal.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await externa.goto('/mis-pagos')
  await expect(externa.getByRole('row', { name: /Aprobado/ }).filter({ hasText: monto(8_500) }).first()).toBeVisible()
})
