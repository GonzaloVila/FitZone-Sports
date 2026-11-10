import { expect, test } from '@playwright/test'
import { abrirComo, apiComo, USUARIOS } from './soporte'

// Módulo 1 · Usuarios y membresías: RF-01 y RF-02.

test.afterEach(async () => {
  // RF-02 suspende a Joaquín y lo reactiva por la interfaz; si falló a mitad de camino, se lo deja activo por la API.
  const api = await apiComo('gerente')
  await api.patch(`socios/${USUARIOS.joaquin.socioId}/membresias`, { data: { estado: 'ACTIVA' } })
  await api.dispose()
})

test('RF-01 · la recepción da de alta a un socio nuevo con DNI, contacto y plan, y el socio entra a su carnet', async ({
  browser,
  page,
}) => {
  // DNI y correo únicos por corrida: el alta no se puede repetir con los mismos datos.
  const sufijo = String(Date.now()).slice(-7)
  const nuevo = { nombre: 'Martina Gómez', dni: `4${sufijo}`, email: `martina.${sufijo}@fitzone.test`, telefono: '+5491155550000' }

  const recepcion = await abrirComo(browser, 'recepcion')
  await recepcion.goto('/socios')
  await recepcion.getByRole('button', { name: 'Nuevo socio' }).click()
  const modal = recepcion.getByRole('dialog', { name: 'Nuevo socio' })

  // Paso 1: datos del usuario (todavía no tiene cuenta) y sede de origen.
  await modal.getByLabel('Nombre y apellido').fill(nuevo.nombre)
  await modal.getByLabel('DNI').fill(nuevo.dni)
  await modal.getByLabel('Teléfono (opcional)').fill(nuevo.telefono)
  await modal.getByLabel('Correo').fill(nuevo.email)
  await modal.getByRole('textbox', { name: 'Contraseña', exact: true }).fill('Password123!')
  await modal.getByLabel('Sede de origen').selectOption({ label: 'Sede Central Belgrano' })
  await modal.getByRole('button', { name: 'Continuar al plan' }).click()

  // Paso 2: plan de la membresía.
  await modal.getByRole('radio', { name: /Mensual/ }).check()
  await modal.getByRole('button', { name: 'Dar de alta' }).click()

  await expect(modal).toBeHidden()
  await expect(recepcion.getByText('Socio dado de alta').first()).toBeVisible()
  await expect(recepcion.getByRole('row', { name: new RegExp(nuevo.nombre) })).toContainText('Mensual')

  // El socio nuevo ya puede iniciar sesión y ve su carnet con el plan elegido y la membresía activa.
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(nuevo.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123!')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/carnet/)
  await expect(page.getByText(nuevo.nombre).first()).toBeVisible()
  await expect(page.getByText(nuevo.dni)).toBeVisible()
  await expect(page.getByText('Mensual').first()).toBeVisible()
  await expect(page.getByText('Activa').first()).toBeVisible()
})

test('RF-02 · el estado de la membresía se consulta por filtro y el gerente suspende y reactiva a un socio', async ({
  browser,
}) => {
  const gerente = await abrirComo(browser, 'gerente')
  await gerente.goto('/socios')

  // El socio en mora aparece al filtrar por membresías vencidas.
  await gerente.getByLabel('Estado de la membresía').selectOption({ label: 'Vencida' })
  await expect(gerente.getByRole('row', { name: new RegExp(USUARIOS.esteban.nombre) })).toBeVisible()
  await expect(gerente.getByRole('row', { name: new RegExp(USUARIOS.camila.nombre) })).toBeHidden()
  await gerente.getByLabel('Estado de la membresía').selectOption({ index: 0 })

  // Suspender a un socio activo.
  await gerente.getByRole('button', { name: `Acciones de ${USUARIOS.joaquin.nombre}` }).click()
  await gerente.getByRole('menuitem', { name: 'Suspender' }).click()
  await gerente.getByRole('dialog', { name: 'Suspender membresía' }).getByRole('button', { name: 'Suspender' }).click()
  await expect(gerente.getByRole('row', { name: new RegExp(USUARIOS.joaquin.nombre) })).toContainText('Suspendida')

  // El socio lo ve en su carnet.
  const socio = await abrirComo(browser, 'joaquin')
  await expect(socio.getByText('Suspendida').first()).toBeVisible()

  // Reactivar.
  await gerente.getByRole('button', { name: `Acciones de ${USUARIOS.joaquin.nombre}` }).click()
  await gerente.getByRole('menuitem', { name: 'Reactivar' }).click()
  await gerente.getByRole('dialog', { name: 'Reactivar membresía' }).getByRole('button', { name: 'Reactivar' }).click()
  await expect(gerente.getByRole('row', { name: new RegExp(USUARIOS.joaquin.nombre) })).toContainText('Activa')
})
