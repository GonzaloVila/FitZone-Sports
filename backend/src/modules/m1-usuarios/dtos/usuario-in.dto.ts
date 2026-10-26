import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { RolAlta } from '../entities/usuario.entity';

const ROLES_ALTA: RolAlta[] = ['EXTERNO', 'RECEPCION', 'GERENTE'];

export class UsuarioIn {
  @ApiProperty({ enum: ROLES_ALTA, description: 'SOCIO no aplica acá: solo por POST /socios.' })
  @IsIn(ROLES_ALTA)
  rol!: RolAlta;

  @ApiProperty({
    example: '35123456',
    minLength: 7,
    maxLength: 20,
    pattern: '^\\d+$',
  })
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  @Matches(/^\d+$/, { message: 'dni solo admite dígitos' })
  dni!: string;

  @ApiProperty({ example: 'Ana Gómez', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({ example: 'ana.gomez@fitzone.com.ar', format: 'email', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    minLength: 8,
    writeOnly: true,
    description: 'Contraseña en claro al momento del alta; el servidor la hashea.',
  })
  @IsString()
  @MinLength(8)
  contrasenia!: string;

  @ApiPropertyOptional({ example: '+54 351 555-1234', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  // La regla por rol no vive en el DTO: `class-validator` valida un campo solo,
  // y aca la obligatoriedad depende de `rol`. UsuariosService la aplica antes de
  // escribir (ver comentario en crear()). `ValidateIf` en lugar de `IsOptional`
  // para que un `null` explícito no se cuele: si viene, IsInt lo rechaza.
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    example: 5,
    description:
      'Sede de trabajo. Obligatoria para RECEPCION (se guarda en EmpleadoSede) y prohibida para EXTERNO/GERENTE.',
  })
  @ValidateIf((dto: { sedeId?: unknown }) => dto.sedeId !== undefined)
  @IsInt()
  @Min(1)
  sedeId?: number;

  @ApiPropertyOptional({ example: 'https://cdn.fitzone.com.ar/fotos/ana.jpg' })
  @IsOptional()
  @IsString()
  fotoUrl?: string;
}