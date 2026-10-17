import { ApiProperty } from '@nestjs/swagger';
import { SedeOut } from './sede-out.dto';

export class ListaSedesDto {
  @ApiProperty({ type: [SedeOut], description: 'Items de la página actual' })
  items!: SedeOut[];

  @ApiProperty({ type: 'integer', example: 42, description: 'Cantidad total que cumple el filtro, sin paginar.' })
  total!: number;
}
