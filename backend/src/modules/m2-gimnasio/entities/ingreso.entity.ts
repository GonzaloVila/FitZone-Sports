export interface Ingreso {
  id: number;
  sede_id: number;
  usuario_id: number;
  fecha_hora_ingreso: Date;
  fecha_hora_egreso: Date | null;
  validado_offline: boolean;
}

export interface IngresoNuevo {
  sede_id: number;
  usuario_id: number;
  fecha_hora_ingreso?: Date;
  validado_offline?: boolean;
}
