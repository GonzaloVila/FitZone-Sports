import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ErrorApi } from '@/compartido/http/errores'
import { ServiciosKey } from '@/compartido/servicios'
import type { EstadoMembresia, Membresia, Socio } from '../services/servicioSocios'
import DetalleSocioPage from './DetalleSocioPage.vue'

// jsdom no implementa <dialog>.showModal(): se completa con lo mínimo para que el modal quede "abierto".
beforeAll(() => {
  const dialogo = HTMLDialogElement.prototype
  dialogo.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialogo.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const servicios = {
  socios: { obtener: vi.fn(), obtenerMembresia: vi.fn(), modificarMembresia: vi.fn() },
  usuarios: { obtener: vi.fn() },
  sedes: { listar: vi.fn() },
}

const pagina = { render: () => null }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/socios', name: 'socios', component: pagina },
    { path: '/socios/:socioId', name: 'socio-detalle', component: pagina },
  ],
})

const socio: Socio = {
  id: 1,
  usuarioId: 101,
  sedeOrigenId: 1,
  fechaAlta: '2026-01-15T10:00:00-03:00',
  nombre: 'Camila Domínguez',
  email: 'camila@fitzone.com',
}

const membresia = (estado: EstadoMembresia): Membresia => ({
  id: 1,
  plan: 'MENSUAL',
  estado,
  fechaInicio: '2026-01-15T00:00:00-03:00',
  fechaFin: '2026-02-15T00:00:00-03:00',
  renuevaAutomatica: false,
})

async function montar(query: Record<string, string> = {}) {
  await router.push({ name: 'socio-detalle', params: { socioId: '1' }, query })
  const wrapper = mount(DetalleSocioPage, {
    global: {
      plugins: [router],
      provide: { [ServiciosKey as symbol]: servicios },
      // La ficha y el carnet no intervienen: se evita armar el QR y sus datos.
      stubs: { FichaSocio: true, CarnetSocio: true },
    },
    attachTo: document.body,
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

const tituloDelModal = (wrapper: Awaited<ReturnType<typeof montar>>) => wrapper.get('dialog h2').text()

describe('DetalleSocioPage: acción pedida desde la lista', () => {
  beforeEach(() => {
    servicios.socios.obtener.mockReset().mockResolvedValue(socio)
    servicios.socios.obtenerMembresia.mockReset().mockResolvedValue(membresia('ACTIVA'))
    servicios.socios.modificarMembresia.mockReset()
    servicios.usuarios.obtener.mockReset().mockResolvedValue({ id: 101, dni: '30111222' })
    servicios.sedes.listar.mockReset().mockResolvedValue([])
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('sin ?accion= no abre ningún modal', async () => {
    const wrapper = await montar()

    expect(tituloDelModal(wrapper)).toBe('')
    wrapper.unmount()
  })

  it('una acción válida y permitida abre su modal y se quita de la URL', async () => {
    const wrapper = await montar({ accion: 'suspender' })

    expect(tituloDelModal(wrapper)).toBe('Suspender la membresía')
    expect(router.currentRoute.value.query).toEqual({})
    expect(router.currentRoute.value.fullPath).toBe('/socios/1')
    wrapper.unmount()
  })

  it.each([
    ['cambiar-plan', 'ACTIVA', 'Cambiar el plan'],
    ['cambiar-plan', 'VENCIDA', 'Cambiar el plan'],
    ['reactivar', 'SUSPENDIDA', 'Reactivar la membresía'],
    ['dejar-de-ser-socio', 'ACTIVA', 'Dejar de ser socio'],
  ] as const)('%s con la membresía %s abre "%s"', async (accion, estado, titulo) => {
    servicios.socios.obtenerMembresia.mockResolvedValue(membresia(estado))

    const wrapper = await montar({ accion })

    expect(tituloDelModal(wrapper)).toBe(titulo)
    expect(router.currentRoute.value.query).toEqual({})
    wrapper.unmount()
  })

  it.each([
    ['suspender', 'SUSPENDIDA'],
    ['suspender', 'VENCIDA'],
    ['reactivar', 'ACTIVA'],
    ['reactivar', 'VENCIDA'],
  ] as const)('%s con la membresía %s no está permitida: no abre nada y limpia la URL', async (accion, estado) => {
    servicios.socios.obtenerMembresia.mockResolvedValue(membresia(estado))

    const wrapper = await montar({ accion })

    expect(tituloDelModal(wrapper)).toBe('')
    expect(router.currentRoute.value.query).toEqual({})
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('una acción inválida o no admitida desde la lista se ignora y se limpia la URL, sin error', async () => {
    for (const accion of ['borrar-todo', 'renovacion-automatica', 'cambiar-sede', '']) {
      const wrapper = await montar({ accion })

      expect(tituloDelModal(wrapper)).toBe('')
      expect(router.currentRoute.value.query).toEqual({})
      wrapper.unmount()
    }
  })

  it('con la membresía no disponible solo se admite dejar de ser socio', async () => {
    servicios.socios.obtenerMembresia.mockRejectedValue(new Error('sin membresía'))

    const conPlan = await montar({ accion: 'cambiar-plan' })
    expect(tituloDelModal(conPlan)).toBe('')
    conPlan.unmount()

    const baja = await montar({ accion: 'dejar-de-ser-socio' })
    expect(tituloDelModal(baja)).toBe('Dejar de ser socio')
    baja.unmount()
  })

  it('espera a que cargue la membresía antes de decidir', async () => {
    let resolver!: (valor: Membresia) => void
    servicios.socios.obtenerMembresia.mockReturnValue(new Promise<Membresia>((resolve) => (resolver = resolve)))
    await router.push({ name: 'socio-detalle', params: { socioId: '1' }, query: { accion: 'suspender' } })
    const wrapper = mount(DetalleSocioPage, {
      global: {
        plugins: [router],
        provide: { [ServiciosKey as symbol]: servicios },
        stubs: { FichaSocio: true, CarnetSocio: true },
      },
      attachTo: document.body,
    })
    await flushPromises()

    expect(wrapper.find('dialog h2').text()).toBe('')
    expect(router.currentRoute.value.query).toEqual({ accion: 'suspender' })

    resolver(membresia('ACTIVA'))
    await flushPromises()
    await flushPromises()

    expect(tituloDelModal(wrapper)).toBe('Suspender la membresía')
    expect(router.currentRoute.value.query).toEqual({})
    wrapper.unmount()
  })

  it('si el socio no existe, solo limpia la URL', async () => {
    servicios.socios.obtener.mockRejectedValue(new ErrorApi(404, 'No existe'))

    const wrapper = await montar({ accion: 'suspender' })

    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(wrapper.text()).toContain('El socio no existe o ya no es socio.')
    expect(router.currentRoute.value.query).toEqual({})
    wrapper.unmount()
  })

  it('conserva otros parámetros de la URL al quitar la acción', async () => {
    const wrapper = await montar({ accion: 'suspender', otro: 'x' })

    expect(router.currentRoute.value.query).toEqual({ otro: 'x' })
    wrapper.unmount()
  })
})
