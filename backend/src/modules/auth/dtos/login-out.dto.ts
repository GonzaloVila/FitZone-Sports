import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import type { RolUsuario } from '../../m1-usuarios/entities/usuario.entity';

@Exclude()
export class LoginOut {
  @Expose()
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @Expose()
  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @Expose()
  @ApiProperty({ example: 3600, description: 'Segundos hasta el vencimiento del token.' })
  expiresIn!: number;

  @Expose()
  @ApiProperty({ example: 'RECEPCION' })
  rol!: RolUsuario;

  @Expose()
  @ApiPropertyOptional({
    example: 5,
    description: 'Sucursal de trabajo. Solo presente para rol RECEPCION.',
  })
  sedeId?: number;

  @Expose()
  @ApiPropertyOptional({
    example: 12,
    description: 'ID de socio. Solo presente para rol SOCIO (se usa en POST /ingresos).',
  })
  socioId?: number;
}
