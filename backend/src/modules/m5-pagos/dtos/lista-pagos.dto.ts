import { ApiProperty } from '@nestjs/swagger';
import { PagoOut } from './pago-out.dto';

export class ListaPagosDto {
  @ApiProperty({ type: [PagoOut], description: 'Items de la página actual' })
  items!: PagoOut[];

  @ApiProperty({ type: 'integer', example: 42, description: 'Cantidad total que cumple el filtro, sin paginar.' })
  total!: number;
}
