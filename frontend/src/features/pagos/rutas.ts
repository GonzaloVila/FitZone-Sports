import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router'
import { esEnteroPositivo, textoDe, type ConsultaCruda } from '@/compartido/parametrosDeDireccion'

// El pago de una reserva ya no es una pantalla sino un modal de "Mis reservas": el enlace viejo /pagos/nuevo?reservaId=<id>
// redirige a /canchas?vista=mis-reservas&pagar=<id>, que abre ese modal. Sin un id válido, solo a "Mis reservas".
export function destinoDePagoDeReserva(query: ConsultaCruda): RouteLocationRaw {
  const reservaId = textoDe(query, 'reservaId')
  const pagar = reservaId !== null && esEnteroPositivo(reservaId) ? { pagar: reservaId } : {}
  return { name: 'canchas', query: { vista: 'mis-reservas', ...pagar } }
}

export const rutasPagos: RouteRecordRaw[] = [
  {
    path: '/pagos',
    name: 'pagos',
    component: () => import('./pages/PagosPage.vue'),
    meta: {
      roles: ['RECEPCION', 'GERENTE'],
      navegacion: { etiqueta: 'Pagos', orden: 8, icono: 'pagos', seccion: 'administracion' },
    },
  },
  {
    // Los pagos propios de quien reserva (SOCIO y EXTERNO). Sin sección (no es una actividad ni una tarea de administración) y
    // con el orden más alto de los ítems de esos roles (Mi carnet 1, Clases 4, Canchas 6): es la última opción de su barra.
    path: '/mis-pagos',
    name: 'mis-pagos',
    component: () => import('./pages/MisPagosPage.vue'),
    meta: {
      roles: ['SOCIO', 'EXTERNO'],
      navegacion: { etiqueta: 'Mis pagos', orden: 7, icono: 'pagos' },
    },
  },
  {
    // Enlace viejo: sigue funcionando como redirección.
    path: '/pagos/nuevo',
    name: 'pagar-reserva',
    redirect: (to) => destinoDePagoDeReserva(to.query),
    meta: { roles: ['SOCIO', 'EXTERNO'] },
  },
  {
    path: '/reportes/ingresos',
    name: 'reporte-ingresos',
    component: () => import('./pages/ReporteIngresosPage.vue'),
    meta: {
      roles: ['GERENTE'],
      navegacion: { etiqueta: 'Reportes', orden: 9, icono: 'reportes', seccion: 'administracion' },
    },
  },
]
