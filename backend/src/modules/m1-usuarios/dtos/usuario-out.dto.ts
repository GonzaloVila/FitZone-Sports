import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { RolUsuario } from '../repositories/usuario.repository';

@Exclude()
export class UsuarioOutDto {
  @Expose()
  @ApiProperty()
  id: number;

  @Expose()
  @ApiProperty({ enum: ['SOCIO', 'EXTERNO', 'RECEPCION', 'GERENTE'] })
  rol: RolUsuario;

  @Expose()
  @ApiProperty({ example: '35123456' })
  dni: string;

  @Expose()
  @ApiProperty({ example: 'Ana Gómez' })
  nombre: string;

  @Expose()
  @ApiProperty({ example: 'ana.gomez@fitzone.com.ar' })
  email: string;

  @Expose()
  @ApiProperty({ nullable: true, example: '+54 351 555-1234' })
  telefono?: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: 'https://cdn.fitzone.com.ar/fotos/ana.jpg' })
  foto_url?: string | null;
}