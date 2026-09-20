import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RolAlta } from '../entities/usuario.entity';

const ROLES_ALTA: RolAlta[] = ['EXTERNO', 'RECEPCION', 'GERENTE'];

export class CrearUsuarioDto {
  @ApiProperty({ enum: ROLES_ALTA, description: 'SOCIO no aplica acá: solo por POST /socios.' })
  @IsIn(ROLES_ALTA)
  rol: RolAlta;

  @ApiProperty({ example: '35123456', minLength: 7, maxLength: 20 })
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  @Matches(/^\d+$/, { message: 'dni solo admite dígitos' })
  dni: string;

  @ApiProperty({ example: 'Ana Gómez', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ example: 'ana.gomez@fitzone.com.ar', format: 'email' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    minLength: 8,
    writeOnly: true,
    description: 'Contraseña en claro al momento del alta; el servidor la hashea.',
  })
  @IsString()
  @MinLength(8)
  contrasenia: string;

  @ApiPropertyOptional({ example: '+54 351 555-1234', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @ApiPropertyOptional({ example: 'https://cdn.fitzone.com.ar/fotos/ana.jpg' })
  @IsOptional()
  @IsString()
  foto_url?: string;
}