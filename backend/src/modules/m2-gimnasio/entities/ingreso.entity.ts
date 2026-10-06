export interface Ingreso {
  id: number;
  sede_id: number;
  socio_id: number;
  // Nombre y DNI del socio, resueltos por el repositorio con un join a
  // Socio -> Usuario. Existen para que la pantalla del recepcionista (listado de
  // quienes están adentro y egreso) muestre a quién egresa sin una segunda llamada.
  nombre: string;
  dni: string;
  fecha_hora_ingreso: Date;
  fecha_hora_egreso: Date | null;
  validado_offline: boolean;
}

export interface IngresoNuevo {
  sede_id: number;
  socio_id: number;
  fecha_hora_ingreso?: Date;
  validado_offline?: boolean;
}
