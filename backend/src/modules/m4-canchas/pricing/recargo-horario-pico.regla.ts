import { Injectable } from '@nestjs/common';
import { PICO_DESDE, PICO_HASTA, PICO_RECARGO_PCT, TIMEZONE_SEDE } from './constantes-de-precio';
import type { ContextoDePrecio } from './contexto-de-precio';
import type { ReglaDePrecio } from './regla-de-precio';

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

// Franja pico [PICO_DESDE, PICO_HASTA) en hora local de la sede: aplica a la reserva
// que EMPIEZA dentro de la franja. Ventana medio-abierta: arrancar exactamente a
// PICO_HASTA ya no es pico. Regla extra: una reserva que CUBRE TODA la franja pico
// (arranca en/antes de PICO_DESDE y termina en/despues de PICO_HASTA, ej. 18:00-22:00)
// tambien lleva el plus. Orden 20.
@Injectable()
export class RecargoHorarioPico implements ReglaDePrecio {
  aplica(ctx: ContextoDePrecio): boolean {
    const inicio = horaLocal(ctx.inicio);
    const fin = horaLocal(ctx.fin);
    const empiezaEnFranja = inicio >= PICO_DESDE && inicio < PICO_HASTA;
    const cubreFranjaPico = inicio <= PICO_DESDE && fin >= PICO_HASTA;
    return empiezaEnFranja || cubreFranjaPico;
  }

  aplicar(precio: number, _ctx: ContextoDePrecio): number {
    return precio * (1 + PICO_RECARGO_PCT / 100);
  }
}
