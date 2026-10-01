export type PlanMembresia = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';

export type EstadoMembresia = 'ACTIVA' | 'VENCIDA' | 'SUSPENDIDA';

export interface Membresia {
  id: number;
  socio_id: number;
  plan: PlanMembresia;
  estado: EstadoMembresia;
  fecha_inicio: Date;
  fecha_fin: Date;
  renueva_automatica: boolean;
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