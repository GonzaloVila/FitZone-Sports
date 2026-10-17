import { ApiProperty } from '@nestjs/swagger';
import { UsuarioOut } from './usuario-out.dto';

export class ListaUsuariosDto {
  @ApiProperty({ type: [UsuarioOut], description: 'Items de la página actual' })
  items!: UsuarioOut[];

  @ApiProperty({ type: 'integer', example: 42, description: 'Cantidad total que cumple el filtro, sin paginar.' })
  total!: number;
}
