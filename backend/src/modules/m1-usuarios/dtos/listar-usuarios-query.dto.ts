import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { RolUsuario } from '../entities/usuario.entity';

const ROLES: RolUsuario[] = ['SOCIO', 'EXTERNO', 'RECEPCION', 'GERENTE'];

export class ListarUsuariosQueryDto {
  @ApiPropertyOptional({
    enum: ROLES,
    description: 'Rol del usuario. Sin filtro devuelve todos los roles.',
  })
  @IsOptional()
  @IsIn(ROLES)
  rol?: RolUsuario;

  @ApiPropertyOptional({
    description: 'Coincidencia parcial sobre el nombre, sin distinguir mayusculas.',
    example: 'Ana',
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    format: 'email',
    description: 'Email exacto (es unico en el esquema).',
    example: 'ana.gomez@fitzone.com.ar',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number = 20;
}
