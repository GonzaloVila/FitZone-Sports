import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UsuarioPatch {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({
    type: 'string',
    example: '+54 351 555-1234',
    maxLength: 20,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string | null;

  @ApiPropertyOptional({
    type: 'string',
    example: 'https://cdn.fitzone.com.ar/fotos/ana.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  foto_url?: string | null;

  @ApiPropertyOptional({
    minLength: 8,
    writeOnly: true,
    description: 'Nueva contraseña; el servidor la hashea.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  contrasenia?: string;
}