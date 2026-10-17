import { ApiProperty } from '@nestjs/swagger';
import { ReservaClaseOut } from './reserva-clase-out.dto';

export class ListaReservasClaseDto {
  @ApiProperty({ type: [ReservaClaseOut], description: 'Items de la página actual' })
  items!: ReservaClaseOut[];

  @ApiProperty({ type: 'integer', example: 42, description: 'Cantidad total que cumple el filtro, sin paginar.' })
  total!: number;
}
