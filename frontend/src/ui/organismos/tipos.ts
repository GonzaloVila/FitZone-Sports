export interface ColumnaTabla {
  // Identifica la columna: la celda se personaliza con el slot `celda-<clave>`; sin slot se muestra fila[clave].
  clave: string
  etiqueta: string
  // Si es true, la celda de esta columna es el encabezado de su fila (<th scope="row">).
  encabezadoFila?: boolean
  // Si es true, la columna ocupa lo justo para su contenido y el espacio sobrante va a las demás.
  ajustada?: boolean
  // Alineación del encabezado y de las celdas (por defecto, al inicio).
  alineacion?: 'inicio' | 'centro' | 'fin'
  // Si es true, el encabezado puede partirse en varias líneas (balanceadas); por defecto va en una sola.
  encabezadoEnLineas?: boolean
  // Si es true, el encabezado y todas las celdas de la columna llevan una línea vertical en su borde inicial (separa, por
  // ejemplo, la columna de acciones del resto). Por defecto no hay línea.
  conDivisor?: boolean
}
