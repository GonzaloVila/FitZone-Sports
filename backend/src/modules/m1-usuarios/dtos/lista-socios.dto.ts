import { ApiProperty } from '@nestjs/swagger';
import { SocioOut } from './socio-out.dto';

export class ListaSociosDto {
  @ApiProperty({ type: [SocioOut], description: 'Items de la página actual' })
  items!: SocioOut[];

  @ApiProperty({ type: 'integer', example: 42, description: 'Cantidad total que cumple el filtro, sin paginar.' })
  total!: number;
}
