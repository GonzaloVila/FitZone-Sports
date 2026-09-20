import type { PlanMembresia } from './socio.entity';

export type EstadoMembresia = "ACTIVA" | "VENCIDA" | "SUSPENDIDA";

export interface Membresia {
  id: number;
  socio_id: number;
  plan: PlanMembresia;
  estado: EstadoMembresia;
  fecha_inicio: Date;
  fecha_fin: Date;
  renueva_automatica: boolean;
}

export interface MembresiaNueva {
  socio_id: number;
  plan: PlanMembresia;
  renueva_automatica?: boolean;
  fecha_inicio?: Date;
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