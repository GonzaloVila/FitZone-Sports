import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { SociosService } from '../m1-usuarios/services/socios.service';
import { UsuariosService } from '../m1-usuarios/services/usuarios.service';
import { LoginIn } from './dtos/login-in.dto';
import { LoginOut } from './dtos/login-out.dto';
import { credencialesInvalidas } from './errors/auth.errors';
import type { JwtPayload } from './strategies/jwt.strategy';

// Hash valido de bcrypt que no corresponde a ninguna contraseña real. Se usa
// para comparar igual cuando el email no existe, asi bcrypt.compare tarda lo
// mismo en los dos casos y la respuesta no delata por timing si el email
// esta o no registrado.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Rw0yhlOqFV/VFWmvfUwm6Qp3pbFBK';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly sociosService: SociosService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginIn): Promise<LoginOut> {
    const usuario = await this.usuariosService.buscarParaAutenticar(dto.email);
    const coincide = await bcrypt.compare(dto.contrasenia, usuario?.contrasenia ?? DUMMY_HASH);

    if (!usuario || !coincide) {
      throw credencialesInvalidas();
    }

    const sedeId = usuario.rol === 'RECEPCION' && usuario.sedeId !== null ? usuario.sedeId : undefined;
    // El socioId viaja en el token para que la app lo mande en POST /ingresos
    // sin resolverlo aparte (igual que sedeId para RECEPCION).
    const socioId =
      usuario.rol === 'SOCIO' ? await this.sociosService.obtenerSocioIdPorUsuario(usuario.id) : null;
    const socioIdPayload = socioId ?? undefined;

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: usuario.id,
      rol: usuario.rol,
      ...(sedeId !== undefined && { sedeId: sedeId }),
      ...(socioIdPayload !== undefined && { socioId: socioIdPayload }),
    };

    const expiresIn = this.configService.get<number>('JWT_EXPIRES_IN')!;
    const accessToken = this.jwtService.sign(payload, { expiresIn });

    return plainToInstance(LoginOut, {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: expiresIn,
      rol: usuario.rol,
      sedeId: sedeId,
      socioId: socioIdPayload,
    });
  }
}
