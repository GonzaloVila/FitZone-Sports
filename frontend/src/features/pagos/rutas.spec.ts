import { describe, expect, it } from 'vitest'

import { rutasAcceso } from '../acceso/rutas'
import { rutasCanchas } from '../canchas/rutas'
import { rutasClases } from '../clases/rutas'
import { rutasSocios } from '../socios/rutas'
import { rutasPersonal } from '../usuarios/rutas'
import { destinoDePagoDeReserva, rutasPagos } from './rutas'

// Las etiquetas del menú de un rol, en el orden en que se muestran (la barra se ordena por `navegacion.orden`).
function menuDe(rol: 'SOCIO' | 'EXTERNO' | 'RECEPCION' | 'GERENTE'): string[] {
  return [...rutasAcceso, ...rutasCanchas, ...rutasClases, ...rutasPagos, ...rutasSocios, ...rutasPersonal]
    .filter((ruta) => ruta.meta?.navegacion && (ruta.meta.roles as readonly string[] | undefined)?.includes(rol))
    .sort((a, b) => a.meta!.navegacion!.orden - b.meta!.navegacion!.orden)
    .map((ruta) => ruta.meta!.navegacion!.etiqueta)
}

function rolesDe(nombre: string): readonly string[] {
  const ruta = rutasPagos.find((candidata) => candidata.name === nombre)
  return ruta?.meta?.roles ?? []
}

describe('rutas de pagos', () => {
  it('quien reserva (SOCIO y EXTERNO) puede entrar al enlace viejo de pago', () => {
    expect(rolesDe('pagar-reserva')).toEqual(['SOCIO', 'EXTERNO'])
  })

  it('la lista de pagos y el reporte quedan para el personal', () => {
    expect(rolesDe('pagos')).toEqual(['RECEPCION', 'GERENTE'])
    expect(rolesDe('reporte-ingresos')).toEqual(['GERENTE'])
  })

  it('"Mis pagos" es solo de quien reserva (SOCIO y EXTERNO) y tiene su ítem de menú', () => {
    const ruta = rutasPagos.find((candidata) => candidata.name === 'mis-pagos')

    expect(ruta?.path).toBe('/mis-pagos')
    expect(rolesDe('mis-pagos')).toEqual(['SOCIO', 'EXTERNO'])
    expect(ruta?.meta?.navegacion).toMatchObject({ etiqueta: 'Mis pagos', icono: 'pagos' })
  })

  it('"Mis pagos" es la última opción del menú de SOCIO y de EXTERNO, y no aparece para el personal', () => {
    expect(menuDe('SOCIO')).toEqual(['Mi carnet', 'Clases', 'Canchas', 'Mis pagos'])
    expect(menuDe('EXTERNO')).toEqual(['Canchas', 'Mis pagos'])
    expect(menuDe('RECEPCION')).not.toContain('Mis pagos')
    expect(menuDe('GERENTE')).not.toContain('Mis pagos')
  })

  it('el menú del personal no cambia: sigue el orden de sus ítems', () => {
    expect(menuDe('RECEPCION')).toEqual(['Socios', 'Acceso', 'Clases', 'Canchas', 'Pagos'])
    expect(menuDe('GERENTE')).toEqual(['Socios', 'Acceso', 'Clases', 'Canchas', 'Pagos', 'Reportes', 'Personal'])
  })

  it('/pagos sigue cerrada a SOCIO y EXTERNO, y /mis-pagos al personal', () => {
    expect(rolesDe('pagos')).not.toContain('SOCIO')
    expect(rolesDe('pagos')).not.toContain('EXTERNO')
    expect(rolesDe('mis-pagos')).not.toContain('RECEPCION')
    expect(rolesDe('mis-pagos')).not.toContain('GERENTE')
  })

  it('/pagos/nuevo es una redirección (el pago ya no es una pantalla)', () => {
    const ruta = rutasPagos.find((candidata) => candidata.path === '/pagos/nuevo')

    expect(ruta?.redirect).toBeTypeOf('function')
    expect(ruta?.component).toBeUndefined()
  })
})

describe('destinoDePagoDeReserva', () => {
  it('lleva a Mis reservas con ?pagar=<id> para abrir el modal de esa reserva', () => {
    expect(destinoDePagoDeReserva({ reservaId: '12' })).toEqual({
      name: 'canchas',
      query: { vista: 'mis-reservas', pagar: '12' },
    })
  })

  it('sin un id válido lleva solo a Mis reservas', () => {
    for (const query of [{}, { reservaId: 'abc' }, { reservaId: '0' }, { reservaId: '-4' }, { reservaId: '' }]) {
      expect(destinoDePagoDeReserva(query)).toEqual({ name: 'canchas', query: { vista: 'mis-reservas' } })
    }
  })
})
