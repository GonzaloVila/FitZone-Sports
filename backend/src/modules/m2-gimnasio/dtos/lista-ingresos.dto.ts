import { ApiProperty } from '@nestjs/swagger';
import { IngresoOut } from './ingreso-out.dto';

export class ListaIngresosDto {
  @ApiProperty({ type: [IngresoOut], description: 'Items de la página actual' })
  items!: IngresoOut[];

  @ApiProperty({ type: 'integer', example: 42, description: 'Cantidad total que cumple el filtro, sin paginar.' })
  total!: number;
}
