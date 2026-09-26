import { PICO_DESDE, PICO_HASTA, PICO_RECARGO_PCT, TIMEZONE_SEDE } from './pricing-constants';
import type { PricingContext } from './pricing-context';
import type { PricingStrategy } from './pricing-strategy.port';

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

// Ventana medio-abierta [PICO_DESDE, PICO_HASTA): un turno que arranca
// exactamente a PICO_HASTA ya no es pico.
export class PeakHourPricing implements PricingStrategy {
  aplicar(precio: number, ctx: PricingContext): number {
    const inicio = horaLocal(ctx.inicio);
    const fin = horaLocal(ctx.fin);
    const seSolapaConPico = inicio < PICO_HASTA && fin > PICO_DESDE;
    return seSolapaConPico ? precio * (1 + PICO_RECARGO_PCT / 100) : precio;
  }
}
