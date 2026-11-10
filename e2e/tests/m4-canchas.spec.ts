import { expect, test, type Page } from '@playwright/test'
import { abrirComo, apiComo, CANCHAS, fechaEnSede, monto } from './soporte'

// Módulo 4 · Canchas: RF-09, RF-10, RF-11, RF-12 y RN-02.
// Las reservas se hacen dentro de los próximos días (la grilla muestra de hoy a hoy + 6), en horarios distintos por
// recorrido para que ninguno pise el turno de otro.

const FUTBOL5 = CANCHAS.futbol5Belgrano // $16.000 por hora
const PADDLE = CANCHAS.paddleBelgrano

async function abrirGrilla(page: Page, canchaId: number, fecha: string) {
  await page.goto(`/canchas/${canchaId}/turnos?fecha=${fecha}`)
  await expect(page.getByRole('table')).toBeVisible()
}

// Elige el turno, confirma en el modal y devuelve el aviso de la pantalla.
async function reservar(page: Page, hora: string) {
  const fin = `${String(Number(hora.slice(0, 2)) + 1).padStart(2, '0')}:00`
  await page.getByRole('button', { name: `Reservar ${hora} a ${fin}` }).click()
  const modal = page.getByRole('dialog', { name: 'Confirmar reserva' })
  await modal.getByRole('button', { name: 'Confirmar reserva' }).click()
  return modal
}

test.afterEach(async () => {
  // RF-12 pone una cancha en mantenimiento: se la devuelve a operativa aunque el recorrido haya fallado.
  const api = await apiComo('gerente')
  await api.patch(`canchas/${FUTBOL5}`, { data: { estado: 'OPERATIVA' } })
  await api.dispose()
})

test('RF-09 · el gerente da de alta una cancha en una sede con su deporte y costo por hora', async ({ browser }) => {
  const gerente = await abrirComo(browser, 'gerente')
  await gerente.goto('/canchas')
  const conteo = gerente.getByText(/^\d+ canchas$/)
  await expect(conteo).toBeVisible()
  const total = Number((await conteo.textContent())!.match(/\d+/)![0])

  await gerente.getByRole('button', { name: 'Nueva cancha' }).click()
  const modal = gerente.getByRole('dialog', { name: 'Nueva cancha' })
  await modal.getByLabel('Sede').selectOption({ label: 'Sede Caballito Express' })
  await modal.getByLabel('Deporte').selectOption({ label: 'Paddle' })
  await modal.getByLabel('Costo por hora').fill('9500')
  await modal.getByRole('button', { name: 'Crear cancha' }).click()

  await expect(gerente.getByText('Cancha creada')).toBeVisible()
  await expect(gerente.getByText(`${total + 1} canchas`, { exact: true })).toBeVisible()
  await expect(gerente.getByRole('row', { name: /Paddle.*Sede Caballito Express.*9\.500/ })).toBeVisible()
})

test('RF-10 · al reservar un turno queda bloqueado: otro usuario lo ve ocupado y sin la opción de reservar', async ({
  browser,
}) => {
  const fecha = fechaEnSede(2)
  const externa = await abrirComo(browser, 'sofia')
  await abrirGrilla(externa, FUTBOL5, fecha)
  await reservar(externa, '10:00')
  await expect(externa.getByText(/Reserva confirmada por/)).toBeVisible()

  const socia = await abrirComo(browser, 'camila')
  await abrirGrilla(socia, FUTBOL5, fecha)
  await expect(socia.getByRole('row', { name: /10:00 a 11:00/ })).toContainText('Ocupado')
  await expect(socia.getByRole('button', { name: 'Reservar 10:00 a 11:00' })).toBeHidden()
  await expect(socia.getByRole('button', { name: 'Reservar 11:00 a 12:00' })).toBeVisible()
})

test('RF-11 · precio dinámico: 15% de descuento al socio vigente y 20% de recargo de 19 a 21 hs', async ({ browser }) => {
  const fecha = fechaEnSede(2)
  const socia = await abrirComo(browser, 'camila')
  await abrirGrilla(socia, FUTBOL5, fecha)

  // Socia, fuera del horario pico: 16.000 − 15% = 13.600.
  await reservar(socia, '12:00')
  await expect(socia.getByText(/Reserva confirmada por/)).toContainText(monto(13_600))

  // Socia, en horario pico: 16.000 − 15% + 20% = 16.320.
  await reservar(socia, '19:00')
  await expect(socia.getByText(/Reserva confirmada por/)).toContainText(monto(16_320))

  // Externa, en horario pico: sin descuento, con recargo = 19.200.
  const externa = await abrirComo(browser, 'sofia')
  await abrirGrilla(externa, FUTBOL5, fecha)
  await reservar(externa, '20:00')
  await expect(externa.getByText(/Reserva confirmada por/)).toContainText(monto(19_200))
})

test('RF-12 · una cancha puesta en mantenimiento no admite reservas nuevas', async ({ browser }) => {
  const gerente = await abrirComo(browser, 'gerente')
  await gerente.goto('/canchas')
  await gerente.getByRole('button', { name: `Editar Fútbol 5 #${FUTBOL5}` }).click()
  const modal = gerente.getByRole('dialog', { name: 'Editar cancha' })
  await modal.getByLabel('Estado').selectOption({ label: 'En mantenimiento' })
  await modal.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(modal).toBeHidden()
  await expect(gerente.getByRole('row', { name: new RegExp(`Fútbol 5 #${FUTBOL5}`) })).toContainText('En mantenimiento')

  const socia = await abrirComo(browser, 'camila')
  await socia.goto(`/canchas/${FUTBOL5}/turnos?fecha=${fechaEnSede(3)}`)
  await expect(socia.getByText('Esta cancha está en mantenimiento: no se reservan turnos nuevos.')).toBeVisible()
  await expect(socia.getByRole('button', { name: /^Reservar / })).toHaveCount(0)
})

test('RN-02 · dos usuarios confirman el mismo turno a la vez y solo uno lo consigue', async ({ browser }) => {
  const fecha = fechaEnSede(3)
  const socia = await abrirComo(browser, 'camila')
  const externa = await abrirComo(browser, 'sofia')
  await Promise.all([abrirGrilla(socia, PADDLE, fecha), abrirGrilla(externa, PADDLE, fecha)])

  // Los dos eligen el turno de las 16 y llegan al modal de confirmación con el turno todavía libre.
  for (const page of [socia, externa]) await page.getByRole('button', { name: 'Reservar 16:00 a 17:00' }).click()
  const confirmar = (page: Page) =>
    page.getByRole('dialog', { name: 'Confirmar reserva' }).getByRole('button', { name: 'Confirmar reserva' })
  await expect(confirmar(socia)).toBeEnabled()
  await expect(confirmar(externa)).toBeEnabled()

  // Confirman al mismo tiempo.
  await Promise.all([confirmar(socia).click(), confirmar(externa).click()])

  const exito = (page: Page) => page.getByText(/Reserva confirmada por/)
  const tomado = (page: Page) => page.getByText('Ese turno acaba de ser tomado, elegí otro.')
  await expect(exito(socia).or(tomado(socia))).toBeVisible()
  await expect(exito(externa).or(tomado(externa))).toBeVisible()

  const ganaron = [await exito(socia).isVisible(), await exito(externa).isVisible()].filter(Boolean)
  expect(ganaron).toHaveLength(1)

  // En la base quedó una sola reserva para ese turno.
  const api = await apiComo('gerente')
  const respuesta = await api.get('reservas-canchas', { params: { canchaId: PADDLE, fecha, estado: 'CONFIRMADA', perPage: 100 } })
  const { items } = (await respuesta.json()) as { items: { fechaHoraInicio: string }[] }
  const delTurno = items.filter((r) => new Date(r.fechaHoraInicio).toISOString() === new Date(`${fecha}T16:00:00-03:00`).toISOString())
  expect(delTurno).toHaveLength(1)
  await api.dispose()
})
