import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import type { RolUsuario } from '../../m1-usuarios/entities/usuario.entity';

@Exclude()
export class LoginOut {
  @Expose()
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token!: string;

  @Expose()
  @ApiProperty({ example: 'Bearer' })
  token_type!: string;

  @Expose()
  @ApiProperty({ example: 3600, description: 'Segundos hasta el vencimiento del token.' })
  expires_in!: number;

  @Expose()
  @ApiProperty({ example: 'RECEPCION' })
  rol!: RolUsuario;

  @Expose()
  @ApiPropertyOptional({
    example: 5,
    description: 'Sucursal de trabajo. Solo presente para rol RECEPCION.',
  })
  sede_id?: number;
}
