export const SOCIO_DESCUENTO_PCT = 15;

// PICO_RECARGO_PCT no sale del enunciado del caso: es una decision del equipo que
// sigue PENDIENTE DE CONFIRMAR con la catedra. Vive nombrada y aislada aca para
// que cambiar el valor sea una edicion de una linea, sin tocar las reglas.
export const PICO_RECARGO_PCT = 20;

export const PICO_DESDE = '19:00';
export const PICO_HASTA = '21:00';

// Zona horaria de la sede en formato IANA. La fuente unica es commons/fechas; aca
// se reexporta con el nombre que ya usa el modulo de pricing.
export { ZONA_SEDE as TIMEZONE_SEDE } from '../../../commons/fechas';
