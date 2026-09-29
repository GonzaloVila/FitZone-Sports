// Zona horaria de la sede. Fija y no por configuración regional del proceso:
// el contrato define el filtro `fecha` como "hora local de la sede", y si el
// cálculo dependiera de process.env.TZ o del tz del contenedor, la misma
// consulta daría días distintos en la laptop del dev y en el server.
export const ZONA_SEDE = '-03:00';

const DIA_EN_MS = 86_400_000;

/**
 * Traduce un día de negocio (YYYY-MM-DD) al rango de instantes que lo cubre en
 * hora de la sede.
 *
 * Con offset fijo, sumar 24h exactas cae en la medianoche del día siguiente, así
 * que el rango es semiabierto [desde, hasta): el ingreso de las 00:00 del día
 * siguiente ya no entra.
 */
export function rangoDelDia(fecha: string): { desde: Date; hasta: Date } {
  const desde = new Date(`${fecha}T00:00:00${ZONA_SEDE}`);
  if (Number.isNaN(desde.getTime())) {
    throw new RangeError(`Fecha inválida para armar el rango del día: "${fecha}".`);
  }
  return { desde, hasta: new Date(desde.getTime() + DIA_EN_MS) };
}
