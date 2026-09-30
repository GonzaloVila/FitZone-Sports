// Zona horaria de la sede. Fija y no por configuración regional del proceso:
// el contrato define el filtro `fecha` como "hora local de la sede", y si el
// cálculo dependiera de process.env.TZ o del tz del contenedor, la misma
// consulta daría días distintos en la laptop del dev y en el server.
//
// Fuente única: la misma constante IANA que usa el pricing de canchas. Antes
//vivían dos representaciones distintas (offset fijo -03:00 acá, IANA allá) y
// podían divergir sin que nada lo detectara.
export const ZONA_SEDE = 'America/Argentina/Buenos_Aires';

const DIA_EN_MS = 86_400_000;

// Buenos Aires no observa horario de verano, así que la sede está siempre en
// UTC-3. Se mantiene el offset literal al construir el instante en vez de
// resolver la zona con Intl: es la misma aritmética y no depende de que la base
// de datos ICU del runtime venga completa.
const OFFSET_SEDE = '-03:00';

// Descompone un instante a YYYY-MM-DD en hora local de la sede. Se usa para
// verificar que la fecha pedida no haya rodado al día siguiente.
function aFechaLocal(instante: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_SEDE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((p) => p.type === tipo)?.value ?? '';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

/**
 * Traduce un día de negocio (YYYY-MM-DD) al rango de instantes que lo cubre en
 * hora de la sede.
 *
 * Se construye en hora local de la sede (America/Argentina/Buenos_Aires) y se
 * convierte a instantes UTC absolutos para comparar contra columnas DateTime/Timestamptz.
 * El rango es semiabierto [desde, hasta): el inicio del día siguiente no entra.
 */
export function rangoDelDia(fecha: string): { desde: Date; hasta: Date } {
  const desde = new Date(`${fecha}T00:00:00${OFFSET_SEDE}`);
  if (Number.isNaN(desde.getTime())) {
    throw new RangeError(`Fecha inválida para armar el rango del día: "${fecha}".`);
  }
  // El DTO solo valida el formato (^\d{4}-\d{2}-\d{2}$), así que un día que no
  // existe igual llega acá: new Date('2026-02-30T00:00:00-03:00') no es NaN,
  // rueda solo a 2026-03-02. Sin este chequeo, el filtro `fecha` de ingresos
  // devolvería el día siguiente al que el cliente pidió, en silencio.
  if (aFechaLocal(desde) !== fecha) {
    throw new RangeError(`Fecha inválida para armar el rango del día: "${fecha}".`);
  }
  return { desde, hasta: new Date(desde.getTime() + DIA_EN_MS) };
}
