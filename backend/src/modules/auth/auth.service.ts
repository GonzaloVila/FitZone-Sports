import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { SociosService } from '../m1-usuarios/services/socios.service';
import { UsuariosService } from '../m1-usuarios/services/usuarios.service';
import type { UsuarioParaAutenticar } from '../m1-usuarios/services/usuarios.service';
import { LoginIn } from './dtos/login-in.dto';
import { LoginOut } from './dtos/login-out.dto';
import { credencialesInvalidas, sesionInvalida } from './errors/auth.errors';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import type { JwtPayload } from './strategies/jwt.strategy';

// Hash valido de bcrypt que no corresponde a ninguna contraseña real. Se usa
// para comparar igual cuando el email no existe, asi bcrypt.compare tarda lo
// mismo en los dos casos y la respuesta no delata por timing si el email
// esta o no registrado.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Rw0yhlOqFV/VFWmvfUwm6Qp3pbFBK';

// Lo que devuelve login/refresh: la respuesta del contrato (sin refreshToken) y
// el refresh token en claro. Que el token viaje en cookie o en el body lo decide
// el controller segun el canal del cliente.
export interface SesionEmitida {
  respuesta: LoginOut;
  refreshToken: string;
}

// SHA-256 y no bcrypt: el refresh token ya es aleatorio de 256 bits, no hay
// diccionario que frenar, y asi la busqueda por hash es un lookup indexado.
function hashearToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly sociosService: SociosService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async login(dto: LoginIn): Promise<SesionEmitida> {
    const usuario = await this.usuariosService.buscarParaAutenticar(dto.email);
    const coincide = await bcrypt.compare(dto.contrasenia, usuario?.contrasenia ?? DUMMY_HASH);

    if (!usuario || !coincide) {
      throw credencialesInvalidas();
    }

    // Cada login abre una familia nueva: una sesion de un dispositivo.
    const refreshToken = await this.emitirRefreshToken(usuario.id, randomUUID());
    return { respuesta: await this.emitirAccessToken(usuario), refreshToken };
  }

  // Rota el refresh token: el presentado queda usado y se emite uno nuevo en la
  // misma familia. Todas las fallas dan el mismo 401.
  async refrescar(token: string): Promise<SesionEmitida> {
    const ahora = new Date();
    const fila = await this.refreshTokens.buscarPorHash(hashearToken(token));

    if (!fila || fila.revocadoEn !== null || fila.expiraEn <= ahora) {
      throw sesionInvalida();
    }

    // Un token ya rotado que vuelve a presentarse es robado o de un cliente
    // duplicado: no se sabe cual de las dos copias es la legitima, asi que se
    // cierran todas las sesiones del usuario.
    if (fila.usadoEn !== null || !(await this.refreshTokens.marcarUsado(fila.id, ahora))) {
      await this.refreshTokens.revocarTodasDelUsuario(fila.usuarioId, ahora);
      throw sesionInvalida();
    }

    // Se relee el usuario: el rol y la sede del access token nuevo salen
    // actualizados, no los del login.
    const usuario = await this.usuariosService.buscarParaAutenticarPorId(fila.usuarioId);
    if (!usuario) {
      throw sesionInvalida();
    }

    const refreshToken = await this.emitirRefreshToken(usuario.id, fila.familia);
    return { respuesta: await this.emitirAccessToken(usuario), refreshToken };
  }

  // Revoca la familia del token (la sesion de ese dispositivo). Idempotente: un
  // token desconocido o ya revocado no es error.
  async cerrarSesion(token: string): Promise<void> {
    const fila = await this.refreshTokens.buscarPorHash(hashearToken(token));
    if (fila) {
      await this.refreshTokens.revocarFamilia(fila.familia, new Date());
    }
  }

  // Payload y firma del access token, compartidos por login y refresh para que
  // los dos emitan exactamente lo mismo.
  private async emitirAccessToken(usuario: UsuarioParaAutenticar): Promise<LoginOut> {
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

  // Token opaco: 32 bytes aleatorios en base64url. En la base va solo su hash.
  private async emitirRefreshToken(usuarioId: number, familia: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const vidaSegundos = this.configService.get<number>('REFRESH_EXPIRES_IN')!;

    await this.refreshTokens.crear({
      usuarioId,
      tokenHash: hashearToken(token),
      familia,
      expiraEn: new Date(Date.now() + vidaSegundos * 1000),
    });

    return token;
  }
}
