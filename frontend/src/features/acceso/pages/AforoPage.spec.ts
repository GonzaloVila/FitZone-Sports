import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useSedeActiva } from '@/compartido/composables/useSedeActiva'
import { ServiciosKey } from '@/compartido/servicios'
import ModalRegistrarIngreso from '../components/modales/ModalRegistrarIngreso.vue'
import TablaPersonasDentro from '../components/TablaPersonasDentro.vue'
import AforoPage from './AforoPage.vue'

// RF-05 / RNF-01: la pantalla del puesto de control. Junta el aforo, quién está dentro, el estado de la red, la cola
// offline y la lista local de inhabilitados. Los modales se reemplazan por stubs: acá interesa qué reciben.
// Cada página se desmonta al terminar su test: si no, sus oyentes de online/offline siguen activos en el siguiente.
enableAutoUnmount(afterEach)

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  // jsdom no implementa <dialog>.showModal()/close(): el modal de confirmación de egreso los usa al abrir y al desmontarse.
  const dialogo = HTMLDialogElement.prototype
  dialogo.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialogo.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const SEDES = [
  { id: 1, nombre: 'Belgrano', direccion: 'Cabildo 100', aforoMaximo: 100 },
  { id: 2, nombre: 'Palermo', direccion: 'Santa Fe 200', aforoMaximo: 50 },
]

const persona = (id: number) => ({
  id,
  sedeId: 1,
  socioId: id + 100,
  nombre: `Socio ${id}`,
  dni: `3000000${id}`,
  fechaHoraIngreso: '2026-11-10T12:00:00Z',
  validadoOffline: false,
})

const servicios = {
  sesion: {},
  sedes: { listar: vi.fn() },
  acceso: {
    obtenerAforo: vi.fn(),
    listarIngresos: vi.fn(),
    registrarEgreso: vi.fn(),
    sincronizarIngresos: vi.fn(),
    listarBloqueados: vi.fn(),
  },
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/acceso/aforo', name: 'acceso-aforo', component: { render: () => null } },
    { path: '/acceso/historial', name: 'acceso-historial', component: { render: () => null } },
  ],
})

function enLinea(valor: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(valor)
}

async function montar(usuario: { rol: 'RECEPCION' | 'GERENTE'; sedeId?: number }) {
  const pinia = createPinia()
  // El store de sesión se hidrata con el usuario, como si ya hubiera iniciado sesión.
  pinia.state.value.sesion = { usuario: { usuarioId: 9, ...usuario }, restaurada: true }
  await router.push('/acceso/aforo')
  const wrapper = mount(AforoPage, {
    global: {
      plugins: [pinia, router],
      provide: { [ServiciosKey as symbol]: servicios },
      stubs: { ModalRegistrarIngreso: true, ModalNuevaSede: true },
    },
  })
  await flushPromises()
  return wrapper
}

const insignias = (wrapper: Awaited<ReturnType<typeof montar>>) => wrapper.get('.aforo__estado-red').text()

describe('AforoPage', () => {
  beforeEach(() => {
    localStorage.clear()
    enLinea(true)
    servicios.sedes.listar.mockReset().mockResolvedValue(SEDES)
    servicios.acceso.obtenerAforo.mockReset().mockImplementation(async (sedeId: number) => ({
      sedeId,
      aforoActual: 2,
      aforoMaximo: 100,
      restante: 98,
    }))
    servicios.acceso.listarIngresos.mockReset().mockResolvedValue({ items: [persona(1), persona(2)], total: 2 })
    servicios.acceso.registrarEgreso.mockReset().mockResolvedValue(undefined)
    servicios.acceso.sincronizarIngresos.mockReset()
    servicios.acceso.listarBloqueados.mockReset().mockResolvedValue({
      bloqueados: [{ socioId: 150, motivo: 'VENCIDA', desde: '2026-11-01T00:00:00Z' }],
      total: 1,
      servidorTime: '2026-11-10T12:00:00Z',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // La sede elegida es estado de módulo compartido entre pantallas: se vuelve al valor por defecto.
    useSedeActiva([]).value = null
  })

  it('el RECEPCION ve el aforo y la gente de su sede, sin selector de sede ni "Nueva sede"', async () => {
    const wrapper = await montar({ rol: 'RECEPCION', sedeId: 2 })

    expect(servicios.acceso.obtenerAforo).toHaveBeenCalledWith(2, expect.any(AbortSignal))
    expect(servicios.acceso.listarIngresos).toHaveBeenCalledWith({ sedeId: 2, dentro: true, perPage: 100 }, expect.any(AbortSignal))
    expect(wrapper.find('select[name="sede"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Nueva sede')
    expect(wrapper.text()).toContain('Palermo')
    expect(wrapper.findComponent(TablaPersonasDentro).props('personas')).toHaveLength(2)
  })

  it('el GERENTE elige la sede: arranca en la primera y al cambiarla pide los datos de la otra', async () => {
    const wrapper = await montar({ rol: 'GERENTE' })
    expect(servicios.acceso.obtenerAforo).toHaveBeenLastCalledWith(1, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('Nueva sede')

    await wrapper.get('select[name="sede"]').setValue('2')
    await flushPromises()

    expect(servicios.acceso.obtenerAforo).toHaveBeenLastCalledWith(2, expect.any(AbortSignal))
  })

  it('con red muestra "En línea" y sin cola no ofrece sincronizar', async () => {
    const wrapper = await montar({ rol: 'RECEPCION', sedeId: 1 })

    expect(insignias(wrapper)).toContain('En línea')
    expect(wrapper.text()).not.toContain('Sincronizar pendientes')
  })

  it('al perder la red muestra "Sin conexión" y los pendientes, con el botón de sincronizar deshabilitado', async () => {
    localStorage.setItem(
      'fitzone_accesos_offline',
      JSON.stringify([{ localId: 1, socioId: 7, codigoTotp: '111111', fechaHoraIngreso: '2026-11-10T12:00:00Z', tipo: 'ingreso' }]),
    )
    const wrapper = await montar({ rol: 'RECEPCION', sedeId: 1 })

    window.dispatchEvent(new Event('offline'))
    await flushPromises()

    expect(insignias(wrapper)).toContain('Sin conexión')
    expect(insignias(wrapper)).toContain('1 pendiente')
    const boton = wrapper.findAll('button').find((b) => b.text().includes('Sincronizar pendientes'))!
    expect(boton.attributes('disabled')).toBeDefined()
  })

  it('al volver la red sincroniza la cola sola y refresca el aforo', async () => {
    localStorage.setItem(
      'fitzone_accesos_offline',
      JSON.stringify([{ localId: 1, socioId: 7, codigoTotp: '111111', fechaHoraIngreso: '2026-11-10T12:00:00Z', tipo: 'ingreso' }]),
    )
    servicios.acceso.sincronizarIngresos.mockResolvedValue({
      resultados: [{ localId: 1, ok: true, serverId: 50 }],
      egresosProcesados: [],
    })
    const wrapper = await montar({ rol: 'RECEPCION', sedeId: 1 })
    window.dispatchEvent(new Event('offline'))
    await flushPromises()
    const consultasAntes = servicios.acceso.obtenerAforo.mock.calls.length

    window.dispatchEvent(new Event('online'))
    await flushPromises()

    expect(servicios.acceso.sincronizarIngresos).toHaveBeenCalledTimes(1)
    expect(servicios.acceso.obtenerAforo.mock.calls.length).toBeGreaterThan(consultasAntes)
    expect(insignias(wrapper)).not.toContain('pendiente')
  })

  it('al modal de ingreso le pasa el estado de la red, la cola offline y la lista local de inhabilitados', async () => {
    const wrapper = await montar({ rol: 'RECEPCION', sedeId: 1 })
    const modal = wrapper.findComponent(ModalRegistrarIngreso)

    expect(servicios.acceso.listarBloqueados).toHaveBeenCalledWith(undefined)
    expect(modal.props('enLinea')).toBe(true)
    expect(modal.props('alEncolarOffline')).toEqual(expect.any(Function))
    const bloqueo = modal.props('bloqueoOffline') as (socioId: number) => unknown
    expect(bloqueo(150)).toEqual({ motivo: 'VENCIDA', desde: '2026-11-01T00:00:00Z' })
    expect(bloqueo(7)).toBeNull()
  })

  it('registrar un egreso desde la tabla muestra el aviso y refresca el aforo', async () => {
    const wrapper = await montar({ rol: 'RECEPCION', sedeId: 1 })
    const consultasAntes = servicios.acceso.obtenerAforo.mock.calls.length

    wrapper.findComponent(TablaPersonasDentro).vm.$emit('egresar', 1)
    await flushPromises()

    expect(servicios.acceso.registrarEgreso).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain('Egreso registrado correctamente.')
    expect(servicios.acceso.obtenerAforo.mock.calls.length).toBeGreaterThan(consultasAntes)
  })

  it('si no cargan las sedes, lo avisa', async () => {
    servicios.sedes.listar.mockRejectedValue(new Error('caído'))

    const wrapper = await montar({ rol: 'GERENTE' })

    expect(wrapper.text()).toContain('No se pudo cargar el listado de sedes.')
  })
})
