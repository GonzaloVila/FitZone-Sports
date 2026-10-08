export interface Ingreso {
  id: number;
  sedeId: number;
  socioId: number;
  // Nombre y DNI del socio, resueltos por el repositorio con un join a
  // Socio -> Usuario. Existen para que la pantalla del recepcionista (listado de
  // quienes están adentro y egreso) muestre a quién egresa sin una segunda llamada.
  nombre: string;
  dni: string;
  fechaHoraIngreso: Date;
  fechaHoraEgreso: Date | null;
  validadoOffline: boolean;
}

export interface IngresoNuevo {
  sedeId: number;
  socioId: number;
  fechaHoraIngreso?: Date;
  validadoOffline?: boolean;
}
