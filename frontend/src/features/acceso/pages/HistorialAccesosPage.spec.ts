import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ServiciosKey } from '@/compartido/servicios'
import TablaHistorial from '../components/TablaHistorial.vue'
import HistorialAccesosPage from './HistorialAccesosPage.vue'

// RF-05: historial de accesos. El RECEPCION ve solo su sede (no es un filtro que pueda sacar); el GERENTE, todas.
enableAutoUnmount(afterEach)

const SEDES = [
  { id: 1, nombre: 'Belgrano', direccion: 'Cabildo 100', aforoMaximo: 100 },
  { id: 2, nombre: 'Palermo', direccion: 'Santa Fe 200', aforoMaximo: 50 },
]

const servicios = {
  sesion: {},
  sedes: { listar: vi.fn() },
  acceso: { listarIngresos: vi.fn() },
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/acceso/aforo', name: 'acceso-aforo', component: { render: () => null } },
    { path: '/acceso/historial', name: 'acceso-historial', component: { render: () => null } },
  ],
})

async function montar(usuario: { rol: 'RECEPCION' | 'GERENTE'; sedeId?: number }) {
  const pinia = createPinia()
  pinia.state.value.sesion = { usuario: { usuarioId: 9, ...usuario }, restaurada: true }
  await router.push('/acceso/historial')
  const wrapper = mount(HistorialAccesosPage, {
    global: {
      plugins: [pinia, router],
      provide: { [ServiciosKey as symbol]: servicios },
      stubs: { ModalRegistrarIngreso: true },
    },
  })
  await flushPromises()
  return wrapper
}

const ultimosFiltros = () => servicios.acceso.listarIngresos.mock.lastCall![0]

describe('HistorialAccesosPage', () => {
  beforeEach(() => {
    servicios.sedes.listar.mockReset().mockResolvedValue(SEDES)
    servicios.acceso.listarIngresos.mockReset().mockResolvedValue({ items: [], total: 0 })
  })

  it('el RECEPCION ve el historial de su sede, sin poder elegir otra', async () => {
    const wrapper = await montar({ rol: 'RECEPCION', sedeId: 2 })

    expect(ultimosFiltros()).toMatchObject({ sedeId: 2, page: 1, perPage: 10 })
    expect(wrapper.find('select[name="sede"]').exists()).toBe(false)
  })

  it('el GERENTE arranca viendo todas las sedes y puede filtrar por una', async () => {
    const wrapper = await montar({ rol: 'GERENTE' })
    expect(ultimosFiltros().sedeId).toBeUndefined()

    await wrapper.get('select[name="sede"]').setValue('1')
    await flushPromises()

    expect(ultimosFiltros()).toMatchObject({ sedeId: 1, page: 1 })
  })

  it('"Limpiar" borra los filtros pero el RECEPCION conserva su sede', async () => {
    const wrapper = await montar({ rol: 'RECEPCION', sedeId: 2 })
    await wrapper.get('input[name="fecha"]').setValue('2026-11-10')
    await flushPromises()
    expect(ultimosFiltros()).toMatchObject({ sedeId: 2, fecha: '2026-11-10' })

    const limpiar = wrapper.findAll('button').find((b) => b.text().includes('Limpiar'))!
    await limpiar.trigger('click')
    await flushPromises()

    expect(ultimosFiltros()).toMatchObject({ sedeId: 2, fecha: undefined })
  })

  it('pasar de página pide la siguiente', async () => {
    servicios.acceso.listarIngresos.mockResolvedValue({ items: [], total: 25 })
    const wrapper = await montar({ rol: 'GERENTE' })

    wrapper.findComponent(TablaHistorial).vm.$emit('update:pagina', 2)
    await flushPromises()

    expect(ultimosFiltros().page).toBe(2)
  })

  it('un error de carga se muestra en la pantalla', async () => {
    servicios.acceso.listarIngresos.mockRejectedValue(new Error('caído'))

    const wrapper = await montar({ rol: 'GERENTE' })

    expect(wrapper.text()).toContain('No se pudo cargar el historial de accesos.')
  })
})
