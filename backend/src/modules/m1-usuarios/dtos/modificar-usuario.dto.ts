import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ModificarUsuarioDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({ example: '+54 351 555-1234', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @ApiPropertyOptional({ example: 'https://cdn.fitzone.com.ar/fotos/ana.jpg' })
  @IsOptional()
  @IsString()
  foto_url?: string;

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