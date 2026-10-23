export interface AlmacenToken {
  obtener(): string | null
  guardar(token: string | null): void
}

// El access token vive solo en memoria (closure): no se persiste en localStorage ni en cookies.
export function crearAlmacenToken(): AlmacenToken {
  let token: string | null = null

  return {
    obtener: () => token,
    guardar: (nuevo) => {
      token = nuevo
    },
  }
}
