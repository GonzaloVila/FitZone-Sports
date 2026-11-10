import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorApi } from '@/compartido/http/errores'
import { ServiciosKey } from '@/compartido/servicios'
import ModalNuevaSede from './ModalNuevaSede.vue'

// RNF-04: el alta de una sede desde el modal del GERENTE (usa useAltaSede). Valida antes de enviar, reparte los errores del
// servidor por campo y avisa a la pantalla con la sede creada.
enableAutoUnmount(afterEach)

beforeAll(() => {
  const dialogo = HTMLDialogElement.prototype
  dialogo.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialogo.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const SEDE = { id: 7, nombre: 'Sede Norte', direccion: 'Av. Maipú 1200', aforoMaximo: 80 }
const servicios = { sedes: { crear: vi.fn() } }

async function montar() {
  const wrapper = mount(ModalNuevaSede, {
    props: { abierto: false },
    global: { provide: { [ServiciosKey as symbol]: servicios } },
    attachTo: document.body,
  })
  await wrapper.setProps({ abierto: true })
  await flushPromises()
  return wrapper
}

async function completar(wrapper: Awaited<ReturnType<typeof montar>>, datos: { nombre: string; direccion: string; aforo: string }) {
  await wrapper.get('input[name="nombre"]').setValue(datos.nombre)
  await wrapper.get('input[name="direccion"]').setValue(datos.direccion)
  await wrapper.get('input[name="aforoMaximo"]').setValue(datos.aforo)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('ModalNuevaSede', () => {
  beforeEach(() => {
    servicios.sedes.crear.mockReset().mockResolvedValue(SEDE)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('crea la sede con los datos recortados y avisa a la pantalla', async () => {
    const wrapper = await montar()

    await completar(wrapper, { nombre: '  Sede Norte ', direccion: 'Av. Maipú 1200 ', aforo: '80' })

    expect(servicios.sedes.crear).toHaveBeenCalledWith({ nombre: 'Sede Norte', direccion: 'Av. Maipú 1200', aforoMaximo: 80 })
    expect(wrapper.emitted('creada')).toEqual([[SEDE]])
    expect(wrapper.emitted('update:abierto')?.at(-1)).toEqual([false])
  })

  it('valida antes de enviar: nombre, dirección y una capacidad entera positiva', async () => {
    const wrapper = await montar()

    await completar(wrapper, { nombre: ' ', direccion: '', aforo: '0' })

    expect(servicios.sedes.crear).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('El nombre de la sede es obligatorio.')
    expect(wrapper.text()).toContain('La dirección es obligatoria.')
    expect(wrapper.text()).toContain('La capacidad debe ser un número entero mayor a cero.')
  })

  it('un nombre repetido (409) se muestra junto al campo nombre', async () => {
    servicios.sedes.crear.mockRejectedValue(new ErrorApi(409, 'Ya existe una sede con ese nombre.'))
    const wrapper = await montar()

    await completar(wrapper, { nombre: 'Belgrano', direccion: 'Cabildo 100', aforo: '50' })

    expect(wrapper.text()).toContain('Ya existe una sede con ese nombre.')
    expect(wrapper.emitted('creada')).toBeUndefined()
    expect(wrapper.find('dialog[open]').exists()).toBe(true)
  })

  it('un error sin campo queda como error general del modal', async () => {
    servicios.sedes.crear.mockRejectedValue(new Error('caído'))
    const wrapper = await montar()

    await completar(wrapper, { nombre: 'Sede Norte', direccion: 'Av. Maipú 1200', aforo: '80' })

    expect(wrapper.text()).toContain('No se pudo crear la sede.')
  })

  it('al reabrir el formulario arranca vacío, con la capacidad por defecto', async () => {
    const wrapper = await montar()
    await completar(wrapper, { nombre: ' ', direccion: '', aforo: '0' })

    await wrapper.setProps({ abierto: false })
    await wrapper.setProps({ abierto: true })
    await flushPromises()

    expect((wrapper.get('input[name="nombre"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('input[name="aforoMaximo"]').element as HTMLInputElement).value).toBe('50')
    expect(wrapper.text()).not.toContain('El nombre de la sede es obligatorio.')
  })
})
