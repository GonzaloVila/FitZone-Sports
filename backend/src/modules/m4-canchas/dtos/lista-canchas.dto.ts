import { ApiProperty } from '@nestjs/swagger';
import { CanchaOut } from './cancha-out.dto';

export class ListaCanchasDto {
  @ApiProperty({ type: [CanchaOut], description: 'Items de la página actual' })
  items!: CanchaOut[];

  @ApiProperty({ type: 'integer', example: 42, description: 'Cantidad total que cumple el filtro, sin paginar.' })
  total!: number;
}
