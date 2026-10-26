import { vi } from 'vitest'

import { ErrorApi, type Problema } from '@/compartido/http/errores'
import type { Usuario } from '@/features/usuarios/services/servicioUsuarios'
import type { Socio } from '../services/servicioSocios'
import type { useAltaSocio } from './useAltaSocio'

// Apoyo común de los specs del alta (no es un spec): los servicios simulados y los datos de prueba. Los specs lo
// conectan con `vi.mock('@/compartido/servicios', ...)`. No importa useAltaSocio en tiempo de ejecución para no
// formar un ciclo con ese mock.
export const serviciosMock = {
  usuarios: { crear: vi.fn(), listar: vi.fn() },
  socios: { crear: vi.fn() },
}

export const usuarioCreado: Usuario = {
  id: 201,
  rol: 'EXTERNO',
  dni: '35123456',
  nombre: 'Ana Gómez',
  email: 'ana.gomez@fitzone.com',
}

export const socioCreado: Socio = {
  id: 9,
  usuarioId: 201,
  sedeOrigenId: 2,
  fechaAlta: '2026-10-26T10:00:00-03:00',
  nombre: 'Ana Gómez',
  email: 'ana.gomez@fitzone.com',
}

export const usuarioExistente: Usuario = { id: 77, rol: 'EXTERNO', dni: '28111222', nombre: 'Bruno Paz', email: 'bruno@fitzone.com' }

export function diferida<T>() {
  let resolver!: (valor: T) => void
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve
  })
  return { promesa, resolver }
}

export function error422(errors: string[]) {
  return new ErrorApi(422, 'Datos inválidos', { title: 'Unprocessable', status: 422, detail: 'Datos inválidos', errors } as Problema)
}

export function reiniciarMocks() {
  serviciosMock.usuarios.crear.mockReset().mockResolvedValue(usuarioCreado)
  serviciosMock.usuarios.listar.mockReset().mockResolvedValue({ items: [], total: 0 })
  serviciosMock.socios.crear.mockReset().mockResolvedValue(socioCreado)
}

type Alta = ReturnType<typeof useAltaSocio>

// Un usuario nuevo con todos los datos del paso 1 (con espacios de más, para ver que se recortan) y la sede 2.
export function completarDatos(alta: Alta) {
  Object.assign(alta.datosNuevo, {
    dni: ' 35123456 ',
    nombre: ' Ana Gómez ',
    email: ' ana.gomez@fitzone.com ',
    contrasenia: 'Clave-Segura-123',
    telefono: '',
  })
  alta.sede.value = '2'
}

// Deja el formulario listo para enviar un usuario nuevo con plan Mensual, parado en el paso 2.
export function prepararNuevo(alta: Alta) {
  completarDatos(alta)
  if (!alta.continuar()) throw new Error('El paso 1 de prueba debería ser válido.')
  alta.plan.value = 'MENSUAL'
}

// Deja el formulario listo para dar de alta a un usuario existente, parado en el paso 2.
export function prepararExistente(alta: Alta, plan = 'MENSUAL') {
  alta.modo.value = 'existente'
  alta.seleccionar(usuarioExistente)
  alta.sede.value = '1'
  if (!alta.continuar()) throw new Error('El paso 1 de prueba debería ser válido.')
  alta.plan.value = plan
}
