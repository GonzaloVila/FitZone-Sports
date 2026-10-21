const apiUrl = import.meta.env.VITE_API_URL

if (!apiUrl) {
  throw new Error(
    'Falta la variable VITE_API_URL. Copiá .env.example a .env (en frontend/) y reiniciá el servidor de desarrollo.',
  )
}

export const API_URL: string = apiUrl
