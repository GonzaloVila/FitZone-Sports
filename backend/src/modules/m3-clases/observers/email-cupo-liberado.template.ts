import { ZONA_SEDE } from '../../../commons/fechas';
import type { CupoLiberadoEvent } from './cupo-liberado.event';

// Identidad del aviso (RF-08, ADR-05). Centralizada para que asunto y cuerpo
// (texto y HTML) salgan consistentes; cambiar la marca es editar una línea.
export const NOMBRE_MARCA = 'FitZone Sports';

const COLOR_MARCA = '#f97316';
const COLOR_TEXTO = '#111827';
const COLOR_SUAVE = '#6b7280';
const COLOR_BORDE = '#e5e7eb';

// Horario legible en hora de la sede (ej. "jueves, 01/10/2026, 19:30").
const FORMATO_HORARIO = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_SEDE,
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Solo devuelve el horario si la fecha es válida; si no, se omite del texto.
function horarioTexto(evento: CupoLiberadoEvent): string | null {
  const fecha = new Date(evento.horarioClase);
  return isNaN(fecha.getTime()) ? null : FORMATO_HORARIO.format(fecha);
}

// Nombre de la clase a mostrar; si el evento no lo trae, cae al id.
function nombreClaseTexto(evento: CupoLiberadoEvent): string {
  const nombre = evento.nombreClase?.trim();
  return nombre ? nombre : `#${evento.claseId}`;
}

export function asuntoCupoLiberado(evento: CupoLiberadoEvent): string {
  const horario = horarioTexto(evento);
  return `${NOMBRE_MARCA} · Se liberó un cupo en tu clase de ${nombreClaseTexto(evento)}${horario ? ` (${horario})` : ''}`;
}

export function cuerpoTexto(evento: CupoLiberadoEvent): string {
  const horario = horarioTexto(evento);
  return (
    `Hola,\n\nSe liberó un cupo en la clase ${nombreClaseTexto(evento)} y quedó disponible ` +
    `por Confirmación.\n` +
    (horario ? `Horario: ${horario}\n` : '') +
    `Ingresá al sistema para confirmar tu anotación de la lista de espera.\n\n` +
    `Si no confirmás a tiempo, el cupo pasa al siguiente socio en espera.\n\n` +
    `${NOMBRE_MARCA} · Aviso automático, no responder.`
  );
}

export function cuerpoHtml(evento: CupoLiberadoEvent): string {
  const horario = horarioTexto(evento);
  const horarioFila = horario
    ? `<p style="margin:0 0 12px;color:${COLOR_SUAVE};font-size:14px;line-height:1.5;">Horario: <b style="color:${COLOR_TEXTO};">${horario}</b></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:520px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="background:${COLOR_TEXTO};padding:18px 24px;">
<span style="color:${COLOR_MARCA};font-size:18px;font-weight:bold;letter-spacing:.3px;">${NOMBRE_MARCA}</span>
</td></tr>
<tr><td style="padding:24px;">
<h2 style="margin:0 0 14px;color:${COLOR_TEXTO};font-size:18px;">Se liberó un cupo en tu clase</h2>
<p style="margin:0 0 12px;color:${COLOR_TEXTO};font-size:14px;line-height:1.5;">Hola,</p>
<p style="margin:0 0 12px;color:${COLOR_TEXTO};font-size:14px;line-height:1.5;">Se liberó un cupo en la clase <b>${nombreClaseTexto(evento)}</b> y quedó disponible por <b>Confirmación</b>.</p>
${horarioFila}
<p style="margin:0;color:${COLOR_TEXTO};font-size:14px;line-height:1.5;">Ingresá al sistema para confirmar tu anotación de la lista de espera. Si no confirmás a tiempo, el cupo pasa al siguiente socio en espera.</p>
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid ${COLOR_BORDE};">
<p style="margin:0;color:${COLOR_SUAVE};font-size:12px;">${NOMBRE_MARCA} · Aviso automático, no responder.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
