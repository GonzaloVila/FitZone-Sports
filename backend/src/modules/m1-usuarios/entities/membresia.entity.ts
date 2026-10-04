export type PlanMembresia = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';

export type EstadoMembresia = 'ACTIVA' | 'VENCIDA' | 'SUSPENDIDA';

// El enunciado fija los tres planes (RF-02) pero nunca da sus valores, asi que
// estos numeros son decision del equipo. Es la UNICA fuente: la siembra el alta de
// socio y la relee el cambio de plan, y las dos cosas van por el mismo valor.
//
// El precio se congela en la fila de Membresia y no en una tabla de planes por la
// misma razon que Reserva.precio_aplicado existe en M4: el comprobante tiene que
// seguir cuadrando con lo que se cobro el dia del cobro. Si manana sube la tarifa,
// esta constante cambia para las altas nuevas y las viejas conservan lo suyo.
export const PRECIOS_PLAN: Record<PlanMembresia, number> = {
  MENSUAL: 30_000,
  TRIMESTRAL: 80_000,
  ANUAL: 280_000,
};

export interface Membresia {
  id: number;
  socio_id: number;
  plan: PlanMembresia;
  estado: EstadoMembresia;
  // El periodo vigente, no la fecha de alta (esa vive en Socio.fecha_alta). El par
  // (fecha_inicio, fecha_fin) siempre es el periodo que devolvio calcularVigencia,
  // nunca una mezcla: ver el comentario de esa funcion.
  fecha_inicio: Date;
  fecha_fin: Date;
  precio: number;
  renueva_automatica: boolean;
  updated_at: Date;
}

export interface MembresiaActualizable {
  plan?: PlanMembresia;
  renueva_automatica?: boolean;
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
// - desde la fecha_fin PREVIA: la renovacion automatica, para no perder los dias
//   que el socio ya pago y no uso.
//
// La renovacion extiende desde la previa; el cambio de plan no. No es un descuido:
// son operaciones distintas. Y en las dos se escriben las DOS fechas, nunca una sola,
// para que el par (fecha_inicio, fecha_fin) sea siempre un periodo completo y en la
// renovacion los periodos queden contiguos: el nuevo arranca donde termino el viejo.

// GET /bloqueados (Fase 4): un socio no vigente, con el motivo (el estado
// que lo saca de vigencia) y desde cuándo (Membresia.updated_at), para que
// el puesto offline sincronice su lista local de forma incremental.
export interface MembresiaNoVigente {
  usuarioId: number;
  motivo: 'VENCIDA' | 'SUSPENDIDA';
  desde: Date;
}
export function calcularVigencia(
  plan: PlanMembresia,
  desde: Date = new Date(),
): { fecha_inicio: Date; fecha_fin: Date } {
  const fecha_inicio = desde;
  const fecha_fin = new Date(desde);

  switch (plan) {
    case 'MENSUAL':
      fecha_fin.setMonth(fecha_fin.getMonth() + 1);
      break;
    case 'TRIMESTRAL':
      fecha_fin.setMonth(fecha_fin.getMonth() + 3);
      break;
    case 'ANUAL':
      fecha_fin.setFullYear(fecha_fin.getFullYear() + 1);
      break;
  }

  return { fecha_inicio, fecha_fin };
}

// M1 nunca transiciona `estado` a VENCIDA en el momento (solo el cron diario
// lo hace, ver crons/membresias.cron.ts). M2 no puede confiar solo en
// `estado === 'ACTIVA'` para validar el acceso (RF-04): una membresía vencida
// hace unos minutos seguiría marcada ACTIVA hasta la próxima corrida del cron.
// Por eso la vigencia real también exige `fecha_fin >= ahora`.
export function estaVigente(m: Membresia, ahora: Date = new Date()): boolean {
  return m.estado !== 'SUSPENDIDA' && m.fecha_fin.getTime() >= ahora.getTime();
}