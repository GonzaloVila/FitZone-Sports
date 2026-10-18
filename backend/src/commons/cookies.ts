// Lee una cookie del header Cookie crudo. Evita sumar cookie-parser por una sola
// cookie. Devuelve undefined si no esta o si esta vacia.
export function leerCookie(cabecera: string | undefined, nombre: string): string | undefined {
  if (!cabecera) {
    return undefined;
  }

  for (const par of cabecera.split(';')) {
    const igual = par.indexOf('=');
    if (igual === -1 || par.slice(0, igual).trim() !== nombre) {
      continue;
    }

    const crudo = par.slice(igual + 1).trim();
    let valor = crudo;
    try {
      valor = decodeURIComponent(crudo);
    } catch {
      // Percent-encoding invalido: se usa el valor tal cual.
    }
    return valor.length > 0 ? valor : undefined;
  }

  return undefined;
}
