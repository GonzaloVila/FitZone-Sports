import { ApiProperty } from '@nestjs/swagger';
import { DisponibilidadEntrada } from './disponibilidad-entrada.dto';

export class ListaDisponibilidadDto {
  @ApiProperty({ type: [DisponibilidadEntrada], description: 'Items de la página actual' })
  items!: DisponibilidadEntrada[];

  @ApiProperty({ type: 'integer', example: 42, description: 'Cantidad total que cumple el filtro, sin paginar.' })
  total!: number;
}
