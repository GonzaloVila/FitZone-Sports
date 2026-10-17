import { ApiProperty } from '@nestjs/swagger';
import { EsperaOut } from './espera-out.dto';

export class ListaEsperasDto {
  @ApiProperty({ type: [EsperaOut], description: 'Items de la página actual' })
  items!: EsperaOut[];

  @ApiProperty({ type: 'integer', example: 42, description: 'Cantidad total que cumple el filtro, sin paginar.' })
  total!: number;
}
