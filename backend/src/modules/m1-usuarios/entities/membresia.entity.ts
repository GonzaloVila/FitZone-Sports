export type PlanMembresia = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';

export type EstadoMembresia = 'ACTIVA' | 'VENCIDA' | 'SUSPENDIDA';

// El enunciado fija los tres planes (RF-02) pero nunca da sus valores, asi que
// estos numeros son decision del equipo. Es la UNICA fuente: la siembra el alta de
// socio y la relee el cambio de plan, y las dos cosas van por el mismo valor.
//
// El precio se congela en la fila de Membresia y no en una tabla de planes por la
// misma razon que Reserva.precioAplicado existe en M4: el comprobante tiene que
// seguir cuadrando con lo que se cobro el dia del cobro. Si manana sube la tarifa,
// esta constante cambia para las altas nuevas y las viejas conservan lo suyo.
export const PRECIOS_PLAN: Record<PlanMembresia, number> = {
  MENSUAL: 30_000,
  TRIMESTRAL: 80_000,
  ANUAL: 280_000,
};

export interface Membresia {
  id: number;
  socioId: number;
  plan: PlanMembresia;
  estado: EstadoMembresia;
  // El periodo vigente, no la fecha de alta (esa vive en Socio.fechaAlta). El par
  // (fechaInicio, fechaFin) siempre es el periodo que devolvio calcularVigencia,
  // nunca una mezcla: ver el comentario de esa funcion.
  fechaInicio: Date;
  fechaFin: Date;
  precio: number;
  renuevaAutomatica: boolean;
  updatedAt: Date;
}

export interface MembresiaActualizable {
  plan?: PlanMembresia;
  renuevaAutomatica?: boolean;
  estado?: EstadoMembresia;
}

// Respuestas de consulta de vigencia que consumen M2, M3 y M4. Antes vivian en
// el puerto `MembershipValidationPort` de commons; ahora son tipos del dominio
// de la membresia, que es de donde sale la regla que los calcula.
export interface VigenciaMembresia {
  vigente: boolean;
}

export interface EstadoSocioMembresia {
  esSocio: boolean;
  vigente: boolean;
  enMora: boolean;
}

// Unica aritmetica de fechas de la membresia. El ancla la elige el llamador y hay
// exactamente dos reglas:
//
// - desde HOY: el alta (socio.repository) y el cambio de plan
//   (membresia.repository), que el contrato define como "la fecha_fin se recalcula
//   sobre la fecha actual segun el nuevo plan".
// - desde la fechaFin PREVIA: la renovacion automatica, para no perder los dias
//   que el socio ya pago y no uso.
//
// La renovacion extiende desde la previa; el cambio de plan no. No es un descuido:
// son operaciones distintas. Y en las dos se escriben las DOS fechas, nunca una sola,
// para que el par (fechaInicio, fechaFin) sea siempre un periodo completo y en la
// renovacion los periodos queden contiguos: el nuevo arranca donde termino el viejo.

// GET /bloqueados (Fase 4): un socio no vigente, con el motivo (el estado
// que lo saca de vigencia) y desde cuándo (Membresia.updatedAt), para que
// el puesto offline sincronice su lista local de forma incremental. Se
// identifica por socioId (el acceso es de socios).
export interface MembresiaNoVigente {
  socioId: number;
  motivo: 'VENCIDA' | 'SUSPENDIDA';
  desde: Date; 
}

// RF-02 (renovacion automatica): una membresia con renuevaAutomatica=true cuyo
// periodo ya vencio, con lo que el cron de M5 necesita para cobrar (usuarioId,
// precio) y renovar (fechaFin previa como ancla). SUSPENDIDA nunca entra aca.
export interface MembresiaRenovable {
  id: number;
  usuarioId: number;
  plan: PlanMembresia;
  precio: number;
  fechaFin: Date;
}

export function calcularVigencia(
  plan: PlanMembresia,
  desde: Date = new Date(),
): { fechaInicio: Date; fechaFin: Date } {
  const fechaInicio = desde;
  const fechaFin = new Date(desde);

  switch (plan) {
    case 'MENSUAL':
      fechaFin.setMonth(fechaFin.getMonth() + 1);
      break;
    case 'TRIMESTRAL':
      fechaFin.setMonth(fechaFin.getMonth() + 3);
      break;
    case 'ANUAL':
      fechaFin.setFullYear(fechaFin.getFullYear() + 1);
      break;
  }

  return { fechaInicio, fechaFin };
}