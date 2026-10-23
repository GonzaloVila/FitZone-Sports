export interface ColumnaTabla {
  // Identifica la columna: la celda se personaliza con el slot `celda-<clave>`; sin slot se muestra fila[clave].
  clave: string
  etiqueta: string
  // Si es true, la celda de esta columna es el encabezado de su fila (<th scope="row">).
  encabezadoFila?: boolean
}
