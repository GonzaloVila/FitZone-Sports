import { expect, test } from '@playwright/test'
import { abrirComo, apiComo, fechaEnSede, instanteEnSede, SEDES, USUARIOS } from './soporte'

// Módulo 3 · Clases: RF-06, RF-07 y RF-08.

test('RF-06 · el gerente crea una clase con disciplina, instructor, horario y cupo, y aparece en la agenda', async ({
  browser,
}) => {
  const gerente = await abrirComo(browser, 'gerente')
  await gerente.goto('/clases')
  await gerente.getByRole('button', { name: 'Nueva clase' }).click()

  const modal = gerente.getByRole('dialog', { name: 'Nueva clase' })
  await modal.getByLabel('Sede').selectOption({ label: 'Sede Central Belgrano' })
  await modal.getByLabel('Disciplina').fill('Pilates Reformer')
  await modal.getByLabel('Instructor').fill('Lucía Fernández')
  await modal.getByLabel('Día').fill(fechaEnSede(1))
  await modal.getByLabel('Hora de inicio').fill('18:00')
  await modal.getByLabel('Hora de fin').fill('19:00')
  await modal.getByLabel('Cupo').fill('12')
  await modal.getByRole('button', { name: 'Crear clase' }).click()

  await expect(modal).toBeHidden()
  await expect(gerente.getByText('Clase creada')).toBeVisible()
  const fila = gerente.getByRole('row', { name: /Pilates Reformer/ })
  await expect(fila).toContainText('Lucía Fernández')
  await expect(fila).toContainText('12')
})

test('RF-07 · el socio reserva un cupo (el cupo baja) y cancela sin penalidad con más de 2 horas de anticipación', async ({
  browser,
}) => {
  const socio = await abrirComo(browser, 'joaquin')
  await socio.goto('/clases')
  await socio.getByLabel('Ver el detalle de la clase Spinning').click()

  // Spinning: mañana, 15 lugares, 1 ya reservado en el seed.
  const cupos = socio.locator('.fila-dato', { hasText: 'Cupos' }).or(socio.getByText(/libres de 15/)).first()
  await expect(cupos).toContainText('14 libres de 15')

  await socio.getByRole('button', { name: 'Reservar' }).click()
  await expect(socio.getByText('Reserva confirmada. ¡Nos vemos en la clase!')).toBeVisible()
  await expect(socio.getByText('Tenés un cupo reservado')).toBeVisible()
  await expect(cupos).toContainText('13 libres de 15')

  await socio.getByRole('button', { name: 'Cancelar reserva' }).click()
  const modal = socio.getByRole('dialog', { name: 'Cancelar reserva' })
  await modal.getByRole('button', { name: 'Cancelar reserva' }).click()
  await expect(socio.getByText('Reserva cancelada.')).toBeVisible()
  await expect(cupos).toContainText('14 libres de 15')
  // Sin penalidad: no aparece el aviso del cobro.
  await expect(socio.getByRole('button', { name: 'Descargar comprobante' })).toBeHidden()
})

test('RF-08 · con la clase llena el socio se anota en la espera; al liberarse el cupo se le avisa y lo confirma', async ({
  browser,
}) => {
  // Preparación por la API: una clase de un solo lugar, ya ocupado por Camila.
  const gerenteApi = await apiComo('gerente')
  const dia = fechaEnSede(1)
  const creada = await gerenteApi.post('clases', {
    data: {
      sedeId: SEDES.belgrano,
      tipo: 'Funcional Express',
      instructor: 'Diego Ruiz',
      horarioInicio: instanteEnSede(dia, '20:00'),
      horarioFin: instanteEnSede(dia, '21:00'),
      capacidad: 1,
    },
  })
  expect(creada.ok()).toBeTruthy()
  const { id: claseId } = (await creada.json()) as { id: number }
  const socioApi = await apiComo('camila')
  expect((await socioApi.post('reservas-clases', { data: { claseId, socioId: USUARIOS.camila.socioId } })).ok()).toBeTruthy()
  await Promise.all([gerenteApi.dispose(), socioApi.dispose()])

  // Joaquín encuentra la clase llena y se anota en la lista de espera.
  const enEspera = await abrirComo(browser, 'joaquin')
  await enEspera.goto(`/clases/${claseId}`)
  await expect(enEspera.getByRole('button', { name: 'Reservar' })).toBeHidden()
  await enEspera.getByRole('button', { name: 'Anotarme en lista de espera' }).click()
  await expect(enEspera.getByText('Quedaste anotado en la lista de espera.')).toBeVisible()
  await expect(enEspera.getByText('Estás en el lugar 1 de la lista de espera.')).toBeVisible()

  // Camila cancela su reserva y libera el cupo.
  const titular = await abrirComo(browser, 'camila')
  await titular.goto(`/clases/${claseId}`)
  await titular.getByRole('button', { name: 'Cancelar reserva' }).click()
  await titular.getByRole('dialog', { name: 'Cancelar reserva' }).getByRole('button', { name: 'Cancelar reserva' }).click()
  await expect(titular.getByText('Reserva cancelada.')).toBeVisible()

  // A Joaquín se le avisa (Observer) y confirma el cupo.
  await enEspera.reload()
  await expect(enEspera.getByText('Cupo disponible')).toBeVisible()
  await expect(enEspera.getByText('Se liberó un cupo. Se queda con él el primero que confirme.')).toBeVisible()
  await enEspera.getByRole('button', { name: 'Confirmar cupo' }).click()
  await expect(enEspera.getByText('Cupo confirmado. Tu reserva quedó registrada.')).toBeVisible()
  await expect(enEspera.getByText('Tenés un cupo reservado')).toBeVisible()
})
