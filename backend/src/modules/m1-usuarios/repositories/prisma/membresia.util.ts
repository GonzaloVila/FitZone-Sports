import { PlanMembresia } from '../../entities/socio.entity';

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
