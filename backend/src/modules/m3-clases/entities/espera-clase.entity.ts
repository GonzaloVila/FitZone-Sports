export type EstadoEspera = 'EN_ESPERA' | 'NOTIFICADO' | 'CONFIRMADO' | 'CANCELADO';

export interface EsperaClase {
  id: number;
  claseId: number;
  socioId: number;
  estado: EstadoEspera;
  fechaAnotacion: Date;
  fechaNotificacion: Date | null;
  fechaConfirmacion: Date | null;
}

export type EsperaClaseNueva = Omit<
  EsperaClase,
  'id' | 'fechaNotificacion' | 'fechaConfirmacion'
>;
