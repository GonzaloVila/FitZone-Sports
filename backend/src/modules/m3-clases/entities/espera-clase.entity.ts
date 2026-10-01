export type EstadoEspera = 'EN_ESPERA' | 'NOTIFICADO' | 'CONFIRMADO' | 'CANCELADO';

export interface EsperaClase {
  id: number;
  clase_id: number;
  socio_id: number;
  estado: EstadoEspera;
  fecha_anotacion: Date;
  fecha_notificacion: Date | null;
  fecha_confirmacion: Date | null;
}

export type EsperaClaseNueva = Omit<
  EsperaClase,
  'id' | 'fecha_notificacion' | 'fecha_confirmacion'
>;
