// Lectura de la dirección (query) para las pantallas que guardan filtros, página u origen en ella. Todo se valida al leerlo:
// un valor desconocido se ignora como si no estuviera (nunca rompe).

export type Parametros = Record<string, string>

// Lo que se lee de la dirección: acepta el `route.query` del router tal cual.
export type ConsultaCruda = Record<string, unknown>

// Un parámetro repetido (?a=1&a=2) vale como el primero; uno sin valor (?a) o ausente, como no estar.
export function textoDe(query: ConsultaCruda, clave: string): string | null {
  const crudo: unknown = query[clave]
  const valor: unknown = Array.isArray(crudo) ? crudo[0] : crudo
  return typeof valor === 'string' ? valor : null
}

export const esEnteroPositivo = (texto: string) => /^[1-9]\d*$/.test(texto) && Number.isSafeInteger(Number(texto))

// Valor de ?sede= para "Todas las sedes": se distingue de la ausencia del parámetro, que significa "la sede por defecto".
export const SEDE_TODAS = 'todas'

// ?pagina=N: solo se escribe desde la 2; una página inválida vale 1.
export function paginaDe(query: ConsultaCruda): number {
  const pagina = textoDe(query, 'pagina')
  return pagina !== null && esEnteroPositivo(pagina) ? Number(pagina) : 1
}
