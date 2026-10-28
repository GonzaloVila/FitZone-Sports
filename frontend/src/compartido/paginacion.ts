// Posición (desde 1) de la primera y la última fila de la página que se está viendo, para "Mostrando X a Y de Z".
// Sin resultados es 0 y 0.
export function rangoDePagina(total: number, pagina: number, porPagina: number): { desde: number; hasta: number } {
  if (total <= 0) return { desde: 0, hasta: 0 }
  return { desde: (pagina - 1) * porPagina + 1, hasta: Math.min(total, pagina * porPagina) }
}

// El texto del pie de una lista paginada: "Mostrando 11 a 20 de 25 pagos"; con un solo resultado va en singular y sin
// resultados es solo "0 pagos".
export function textoDeRango(total: number, pagina: number, porPagina: number, singular: string, plural: string): string {
  if (total <= 0) return `0 ${plural}`
  const { desde, hasta } = rangoDePagina(total, pagina, porPagina)
  return `Mostrando ${desde} a ${hasta} de ${total} ${total === 1 ? singular : plural}`
}
