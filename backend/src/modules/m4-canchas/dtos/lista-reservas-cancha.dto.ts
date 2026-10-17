import { ApiProperty } from '@nestjs/swagger';
import { ReservaCanchaOut } from './reserva-cancha-out.dto';

export class ListaReservasCanchaDto {
  @ApiProperty({ type: [ReservaCanchaOut], description: 'Items de la página actual' })
  items!: ReservaCanchaOut[];

  @ApiProperty({ type: 'integer', example: 42, description: 'Cantidad total que cumple el filtro, sin paginar.' })
  total!: number;
}
