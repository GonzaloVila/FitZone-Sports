export interface Sede {
  id: number;
  nombre: string;
  direccion: string;
  aforo_maximo: number;
}

export interface SedeNueva {
  nombre: string;
  direccion: string;
  aforo_maximo: number;
}
