// Devolver el foco a una fila de tabla después de cerrar un modal que se abrió desde una de sus acciones (`AccionesFilaFz`).
//
// Convención de los identificadores (ver `AccionesFilaFz`): con botones de solo ícono cada botón lleva
// `data-identificador="<identificador>-<clave>"`; con el menú "···" el disparador lleva `data-identificador="<identificador>"`.
//
// El control que abrió el modal puede haber desaparecido de la fila (se pagó una reserva y ya no hay "Pagar"): entonces el foco va
// al disparador del menú o, si no hay, al primer control habilitado que siga existiendo en esa fila.
export function enfocarControlDeFila(identificador: string, clave?: string): boolean {
  const selectores = [
    ...(clave ? [`[data-identificador="${identificador}-${clave}"]`] : []),
    `[data-identificador="${identificador}"]`,
    `[data-identificador^="${identificador}-"]`,
  ]
  for (const selector of selectores) {
    const control = [...document.querySelectorAll<HTMLElement>(selector)].find(
      (candidato) => !(candidato as HTMLButtonElement).disabled,
    )
    if (control) {
      control.focus()
      return true
    }
  }
  return false
}
