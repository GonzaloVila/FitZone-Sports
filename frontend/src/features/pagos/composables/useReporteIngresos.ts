import { computed, ref } from 'vue'
import { useServicios } from '@/compartido/servicios'
import { useDescargaPdf } from './useDescargaPdf'

export function useReporteIngresos() {
  const servicio = useServicios().pagos
  const { descargando, error, descargar } = useDescargaPdf()

  const desde = ref('')
  const hasta = ref('')

  const errorFechas = computed(() => {
    if (desde.value && hasta.value && desde.value > hasta.value) {
      return 'La fecha desde no puede ser posterior a la hasta.'
    }
    return null
  })

  const nombreArchivo = computed(() => {
    if (!desde.value && !hasta.value) return 'ingresos.pdf'
    return `ingresos-${desde.value || 'inicio'}-${hasta.value || 'hoy'}.pdf`
  })

  function descargarReporte(): Promise<boolean> {
    if (errorFechas.value) return Promise.resolve(false)
    return descargar(nombreArchivo.value, () =>
      servicio.descargarReporte(desde.value || undefined, hasta.value || undefined),
    )
  }

  return { desde, hasta, errorFechas, descargando, error, descargarReporte }
}
