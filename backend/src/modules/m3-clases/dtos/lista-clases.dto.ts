import { ApiProperty } from '@nestjs/swagger';
import { ClaseOut } from './clase-out.dto';

export class ListaClasesDto {
  @ApiProperty({ type: [ClaseOut], description: 'Items de la página actual' })
  items!: ClaseOut[];

  @ApiProperty({ type: 'integer', example: 42, description: 'Cantidad total que cumple el filtro, sin paginar.' })
  total!: number;
}
