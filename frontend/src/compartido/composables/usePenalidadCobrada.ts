import { computed, ref } from 'vue'

// La clase de la reserva cancelada, con el horario ya formateado para mostrarlo.
export interface ClasePenalizada {
  id: number
  tipo: string
  horario: string
}

export interface PenalidadCobrada {
  pagoId: number
  monto: number
  // null si no se conoce la clase.
  clase: ClasePenalizada | null
}

// La última penalidad cobrada al cancelar una reserva de clase. Es estado de módulo (no se guarda en el navegador): sigue
// ahí al cambiar de pantalla y de clase mientras la sesión esté abierta; se borra al cerrarla (el store de la sesión llama a
// `limpiarPenalidadCobrada`) o cuando el usuario cierra el aviso.
const ultima = ref<PenalidadCobrada | null>(null)

export function limpiarPenalidadCobrada() {
  ultima.value = null
}

export function usePenalidadCobrada() {
  return {
    penalidad: computed(() => ultima.value),
    // Cobrar otra penalidad reemplaza a la anterior.
    registrar(pago: { id: number; monto: number }, clase: ClasePenalizada | null = null) {
      ultima.value = { pagoId: pago.id, monto: pago.monto, clase }
    },
    cerrar: limpiarPenalidadCobrada,
  }
}
