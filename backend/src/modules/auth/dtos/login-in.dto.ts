import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginIn {
  @ApiProperty({ example: 'recepcion@sede5.fitzone.com', format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'miPassword123',
    writeOnly: true,
    description: 'Contraseña en claro; se compara contra el hash guardado en el alta.',
  })
  @IsString()
  @MinLength(1)
  contrasenia!: string;
}
