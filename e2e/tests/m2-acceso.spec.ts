import { expect, test, type Page } from '@playwright/test'
import { abrirComo, apiComo, codigoDelCarnet, USUARIOS } from './soporte'

// Módulo 2 · Control de accesos y aforo: RF-03, RF-04, RF-05 y RN-01.
// Cada recorrido registra por la interfaz el egreso que generó. Si falla a mitad de camino, la limpieza de abajo saca a
// Camila de cualquier sede por la API, así el recorrido siguiente no hereda su ingreso abierto.
test.afterEach(async () => {
  const api = await apiComo('gerente')
  const respuesta = await api.get('ingresos', { params: { socioId: USUARIOS.camila.socioId, dentro: true } })
  const { items } = (await respuesta.json()) as { items: { id: number }[] }
  for (const ingreso of items) await api.post(`ingresos/${ingreso.id}/egreso`)
  await api.dispose()
})

async function abrirModalDeIngreso(page: Page) {
  await page.goto('/acceso/aforo')
  await page.getByRole('button', { name: 'Registrar ingreso' }).first().click()
  return page.getByRole('dialog', { name: 'Registrar ingreso' })
}

async function validarIngreso(page: Page, socioId: number, codigo: string, sede?: string) {
  const modal = page.getByRole('dialog', { name: 'Registrar ingreso' })
  if (sede) await modal.getByLabel('Sede de acceso').selectOption({ label: sede })
  await modal.getByLabel('ID del socio').fill(String(socioId))
  await modal.getByLabel('Código del carnet').fill(codigo)
  await modal.getByRole('button', { name: 'Validar e ingresar' }).click()
  return modal
}

async function ocupacion(page: Page): Promise<number> {
  const valor = page.locator('.indicador', { hasText: 'Ocupación actual' }).locator('dd')
  await expect(valor).toHaveText(/^\d+$/)
  return Number(await valor.textContent())
}

async function registrarEgreso(page: Page, nombre: string) {
  await page.getByRole('button', { name: `Registrar egreso de ${nombre}` }).click()
  await page.getByRole('dialog', { name: 'Registrar egreso' }).getByRole('button', { name: 'Registrar egreso' }).click()
  await expect(page.getByText('Egreso registrado correctamente.')).toBeVisible()
}

test('RF-04 · el socio genera su QR y la recepción valida el ingreso con ese código; un código inválido se rechaza', async ({
  browser,
}) => {
  const socio = await abrirComo(browser, 'camila')
  const codigo = await codigoDelCarnet(socio)

  const recepcion = await abrirComo(browser, 'recepcion')
  await abrirModalDeIngreso(recepcion)

  const invalido = codigo === '000000' ? '111111' : '000000'
  const modal = await validarIngreso(recepcion, USUARIOS.camila.socioId, invalido)
  await expect(modal.getByText(/Ingreso denegado|No se pudo registrar el ingreso/)).toBeVisible()
  await expect(modal.getByText('Ingreso permitido')).toBeHidden()

  await validarIngreso(recepcion, USUARIOS.camila.socioId, codigo)
  await expect(modal.getByText('Ingreso permitido')).toBeVisible()
  await expect(modal.getByText(`Registramos el ingreso de ${USUARIOS.camila.nombre}.`)).toBeVisible()

  await modal.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await registrarEgreso(recepcion, USUARIOS.camila.nombre)
})

test('RF-05 · el aforo de la sede sube con cada ingreso y baja con cada egreso, y muestra quién está adentro', async ({
  browser,
}) => {
  const socio = await abrirComo(browser, 'camila')
  const codigo = await codigoDelCarnet(socio)

  const recepcion = await abrirComo(browser, 'recepcion')
  await recepcion.goto('/acceso/aforo')
  await expect(recepcion.locator('.indicador', { hasText: 'Capacidad máxima' }).locator('dd')).toHaveText('50')
  const antes = await ocupacion(recepcion)

  await abrirModalDeIngreso(recepcion)
  const modal = await validarIngreso(recepcion, USUARIOS.camila.socioId, codigo)
  await expect(modal.getByText('Ingreso permitido')).toBeVisible()
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).last().click()

  await expect.poll(() => ocupacion(recepcion)).toBe(antes + 1)
  await expect(recepcion.getByRole('button', { name: `Registrar egreso de ${USUARIOS.camila.nombre}` })).toBeVisible()

  await registrarEgreso(recepcion, USUARIOS.camila.nombre)
  await expect.poll(() => ocupacion(recepcion)).toBe(antes)
  await expect(recepcion.getByRole('button', { name: `Registrar egreso de ${USUARIOS.camila.nombre}` })).toBeHidden()
})

test('RF-03 · una socia de la sede Belgrano entra sin restricciones a la sede Palermo', async ({ browser }) => {
  const socio = await abrirComo(browser, 'camila')
  const codigo = await codigoDelCarnet(socio)

  // El GERENTE elige la sede en el modal (el RECEPCION solo trabaja en la suya).
  const gerente = await abrirComo(browser, 'gerente')
  await abrirModalDeIngreso(gerente)
  const modal = await validarIngreso(gerente, USUARIOS.camila.socioId, codigo, 'Sede Palermo Hollywood')
  await expect(modal.getByText('Ingreso permitido')).toBeVisible()
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).last().click()

  await gerente.getByRole('combobox', { name: 'Sede' }).selectOption({ label: 'Sede Palermo Hollywood' })
  await registrarEgreso(gerente, USUARIOS.camila.nombre)
})

test('RN-01 · un socio que ya está dentro de una sede no puede ingresar a otra al mismo tiempo', async ({ browser }) => {
  // El seed deja a Joaquín dentro de Belgrano (ingreso sin egreso).
  const socio = await abrirComo(browser, 'joaquin')
  const codigo = await codigoDelCarnet(socio)

  const gerente = await abrirComo(browser, 'gerente')
  await abrirModalDeIngreso(gerente)
  const modal = await validarIngreso(gerente, USUARIOS.joaquin.socioId, codigo, 'Sede Palermo Hollywood')

  await expect(modal.getByText('Ingreso denegado')).toBeVisible()
  await expect(modal.getByText('El socio ya está dentro de una sede. Registrá primero su egreso.')).toBeVisible()
})
