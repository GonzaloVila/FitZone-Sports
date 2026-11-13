// Fechas de prueba relativas a hoy. Una reserva en el pasado se rechaza (422), así que un día futuro escrito a mano
// ("2026-11-12") deja de serlo con el tiempo y rompe la suite sin que nadie haya tocado el código. Estos días se calculan
// desde el momento en que corre la prueba, en hora de la sede, y dan lo mismo en cualquier zona horaria (también en la
// de un servidor de CI, que suele ser UTC).
const ZONA_SEDE = 'America/Argentina/Buenos_Aires';
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// "AAAA-MM-DD" de la sede, `dias` días después de hoy.
export function diaFuturo(dias: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_SEDE }).format(new Date(Date.now() + dias * MS_POR_DIA));
}

// Instante ISO (UTC) de un día y una hora de la sede. Argentina no tiene horario de verano: UTC-3 fijo.
export function enSede(dia: string, hhmm: string): string {
  return new Date(`${dia}T${hhmm}:00-03:00`).toISOString();
}
