import { PICO_DESDE, PICO_HASTA, PICO_RECARGO_PCT, TIMEZONE_SEDE } from './pricing-constants';
import type { PricingContext } from './pricing-context';
import type { PricingStrategy } from './pricing-strategy';

// hourCycle: 'h23' fuerza el formato "00".."23" (evita el "24:00" de h24) para
// poder comparar contra PICO_DESDE/PICO_HASTA ("HH:mm") como strings.
const FORMATO_HORA_LOCAL = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE_SEDE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function horaLocal(fecha: Date): string {
  return FORMATO_HORA_LOCAL.format(fecha);
}

// Franja pico [PICO_DESDE, PICO_HASTA) en hora local de la sede: el recargo se
// aplica a la reserva que EMPIEZA dentro de la franja. No importa el solape de
// intervalos: un turno que arranca a las 18:30 y termina a las 19:30 NO es pico,
// y uno que arranca a las 19:30 sí lo es. Ventana medio-abierta: arrancar
// exactamente a PICO_HASTA ya no es pico.
//
// Regla extra: una reserva que CUBRE TODA la franja pico (arranca en/antes de
// PICO_DESDE y termina en/después de PICO_HASTA, ej. 18:00-22:00 o 06:00-22:00)
// también lleva el plus: aunque no empiece dentro de la franja, la abarca entera.
export class PeakHourPricing implements PricingStrategy {
  aplicar(precio: number, ctx: PricingContext): number {
    const inicio = horaLocal(ctx.inicio);
    const fin = horaLocal(ctx.fin);
    const empiezaEnFranja = inicio >= PICO_DESDE && inicio < PICO_HASTA;
    const cubreFranjaPico = inicio <= PICO_DESDE && fin >= PICO_HASTA;
    return empiezaEnFranja || cubreFranjaPico ? precio * (1 + PICO_RECARGO_PCT / 100) : precio;
  }
}
