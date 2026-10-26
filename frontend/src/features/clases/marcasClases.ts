import { ETIQUETAS_ESTADO_ESPERA } from './presentacion'
import { esperasVigentes, reservaVigente } from './reglas'

// Lo que se marca, junto al nombre de la clase, en la agenda del socio.
export type MarcaClase = 'reservada' | 'en-espera' | 'cupo-disponible'

export interface PresentacionMarca {
  etiqueta: string
  variante: 'exito' | 'neutra' | 'advertencia'
  // Solo la reserva lleva ícono; las demás se distinguen por el texto.
  conTilde: boolean
}

// Los textos de la espera son los mismos que en el detalle.
export const PRESENTACION_MARCA: Record<MarcaClase, PresentacionMarca> = {
  reservada: { etiqueta: 'Reservada', variante: 'exito', conTilde: true },
  'en-espera': { etiqueta: ETIQUETAS_ESTADO_ESPERA.EN_ESPERA, variante: 'neutra', conTilde: false },
  'cupo-disponible': { etiqueta: ETIQUETAS_ESTADO_ESPERA.NOTIFICADO, variante: 'advertencia', conTilde: false },
}

interface ConEstado {
  claseId: number
  estado: string
}

// La marca de cada clase de la agenda según lo que el socio tiene vigente en ella: una reserva CONFIRMADA o una espera
// EN_ESPERA / NOTIFICADO. Las canceladas no marcan, aunque el listado del servidor las incluya. Si hubiera las dos cosas
// en la misma clase, gana la reserva. Solo figuran las clases marcadas.
export function marcasDeClases(
  clases: readonly { id: number }[],
  reservas: readonly ConEstado[],
  esperas: readonly ConEstado[],
): Map<number, MarcaClase> {
  const marcas = new Map<number, MarcaClase>()
  for (const { id } of clases) {
    if (reservaVigente(reservas.filter((reserva) => reserva.claseId === id))) {
      marcas.set(id, 'reservada')
      continue
    }
    const espera = esperasVigentes(esperas.filter((candidata) => candidata.claseId === id))[0]
    if (espera) marcas.set(id, espera.estado === 'NOTIFICADO' ? 'cupo-disponible' : 'en-espera')
  }
  return marcas
}
