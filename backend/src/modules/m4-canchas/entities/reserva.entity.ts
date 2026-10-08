export interface Reserva {
  id: number;
  canchaId: number;
  usuarioId: number;
  fechaHoraInicio: Date;
  fechaHoraFin: Date;
  estado: 'CONFIRMADA' | 'CANCELADA';
  precioAplicado: number;
}
