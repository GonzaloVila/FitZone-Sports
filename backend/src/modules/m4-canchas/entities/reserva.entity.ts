export interface Reserva {
  id: number;
  cancha_id: number;
  usuario_id: number;
  fecha_hora_inicio: Date;
  fecha_hora_fin: Date;
  estado: 'CONFIRMADA' | 'CANCELADA';
  precio_aplicado: number;
}
