import { expect, request, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { URL_API } from '../playwright.config'

// Usuarios del seed (docs/db/seed_supabase_test_data.sql). Todos con la misma contraseña.
export const CONTRASENIA = 'Password123!'
export const USUARIOS = {
  gerente: { email: 'valeria.rossi@fitzone.com', nombre: 'Valeria Rossi' },
  // RECEPCION de la Sede Central Belgrano (sede 1).
  recepcion: { email: 'lucas.benitez@fitzone.com', nombre: 'Lucas Benítez' },
  // Socia de Belgrano, plan anual activo.
  camila: { email: 'camila.dominguez@gmail.com', nombre: 'Camila Domínguez', socioId: 1, usuarioId: 3 },
  // Socio de Palermo, plan mensual activo. El seed lo deja dentro de Belgrano (ingreso abierto).
  joaquin: { email: 'joaquin.pereyra@gmail.com', nombre: 'Joaquín Pereyra', socioId: 2, usuarioId: 4 },
  // Socio con la membresía vencida (en mora).
  esteban: { email: 'esteban.morales@gmail.com', nombre: 'Esteban Morales', socioId: 3, usuarioId: 5 },
  // Cliente externo: reserva y paga canchas, sin descuento de socio.
  sofia: { email: 'sofia.navarro@hotmail.com', nombre: 'Sofía Navarro', usuarioId: 6 },
} as const

export type ClaveUsuario = keyof typeof USUARIOS

// Sedes y canchas del seed.
export const SEDES = { belgrano: 1, palermo: 2, caballito: 3 } as const
export const CANCHAS = { paddleBelgrano: 1, futbol5Belgrano: 2, paddlePalermoMantenimiento: 3 } as const

const ZONA_SEDE = 'America/Argentina/Buenos_Aires'

// Fecha AAAA-MM-DD en hora de la sede, `dias` días después de hoy.
export function fechaEnSede(dias: number): string {
  const instante = new Date(Date.now() + dias * 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_SEDE }).format(instante)
}

// Instante ISO de un día y hora de la sede (Argentina no tiene horario de verano: UTC-3 fijo).
export function instanteEnSede(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00-03:00`).toISOString()
}

export function monto(valor: number): RegExp {
  // "$ 13.600,00" con el formato es-AR; el espacio puede ser uno común o uno duro.
  const entero = Math.trunc(valor).toLocaleString('es-AR')
  return new RegExp(`\\$\\s?${entero.replace('.', '\\.')},00`)
}

// Inicia sesión desde la pantalla de login, como lo haría la persona.
export async function iniciarSesion(page: Page, usuario: ClaveUsuario) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(USUARIOS[usuario].email)
  await page.getByLabel('Contraseña', { exact: true }).fill(CONTRASENIA)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

// Una pestaña nueva con la sesión iniciada: cada usuario en su propio contexto (cookies separadas), como dos personas en
// dos computadoras distintas.
export async function abrirComo(browser: Browser, usuario: ClaveUsuario): Promise<Page> {
  const contexto = await browser.newContext()
  const page = await contexto.newPage()
  await iniciarSesion(page, usuario)
  return page
}

// Cliente de la API con la sesión de un usuario. Se usa solo para PREPARAR datos que el recorrido no prueba (por ejemplo,
// una clase llena para probar la lista de espera); lo que se prueba siempre pasa por la interfaz.
export async function apiComo(usuario: ClaveUsuario): Promise<APIRequestContext> {
  const anonimo = await request.newContext({ baseURL: `${URL_API}/api/v1/` })
  const respuesta = await anonimo.post('auth/login', { data: { email: USUARIOS[usuario].email, contrasenia: CONTRASENIA } })
  expect(respuesta.ok()).toBeTruthy()
  const { accessToken } = (await respuesta.json()) as { accessToken: string }
  await anonimo.dispose()
  return request.newContext({
    baseURL: `${URL_API}/api/v1/`,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
  })
}

// El socio genera su QR desde "Mi carnet" y se lee el código de 6 dígitos que muestra la pantalla.
export async function codigoDelCarnet(page: Page): Promise<string> {
  await page.goto('/carnet')
  await page.getByRole('button', { name: 'Activar o regenerar QR de acceso' }).click()
  await page.getByRole('button', { name: 'Generar código nuevo' }).click()
  const codigo = page.locator('.carnet-pagina__totp-codigo')
  await expect(codigo).toHaveText(/^\d{6}$/)
  return (await codigo.textContent())!.trim()
}
