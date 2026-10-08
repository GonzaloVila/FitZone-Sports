import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { cifrarAesGcm, descifrarAesGcm } from '../../../commons/criptografia';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { SociosService } from '../../m1-usuarios/services/socios.service';
import { UsuariosService } from '../../m1-usuarios/services/usuarios.service';
import { RegistroQrOut } from '../dtos/registro-qr-out.dto';
import { claveTotpNoConfigurada, totpInvalido } from '../errors/auth.errors';

const ISSUER = 'FitZone';

// authenticator es un singleton de otplib: la tolerancia de reloj se
// configura con `.options`, no por llamada a `.verify()`. window:1 tolera
// hasta un intervalo (30s) de desfase entre el celular y el servidor.
authenticator.options = { window: 1 };

// RF-04 (QR dinamico) + Unidad III. Vive en AuthModule porque es el unico
// lugar con los dos lados: el secreto cifrado de M1 (SociosService) y el
// otplib + AES-256-GCM que no tiene por que conocer ningun otro modulo.
// M2 (IngresosService) consume validarIngreso() sin saber que hay TOTP/AES
// detras, igual que M2 consume MembresiasService sin saber de Prisma.
@Injectable()
export class TotpService {
  constructor(
    private readonly sociosService: SociosService,
    private readonly usuariosService: UsuariosService,
    private readonly configService: ConfigService,
  ) {}

  // POST /auth/registro-qr. Genera un secreto nuevo y SOBRESCRIBE el
  // anterior si ya existia: no hay recovery codes (decision del plan), asi
  // que perder el celular se resuelve volviendo a registrar el QR.
  async generarRegistro(usuarioId: number): Promise<RegistroQrOut> {
    const estado = await this.sociosService.obtenerEstadoTotp(usuarioId);
    if (!estado) {
      throw recursoNoEncontrado('El usuario autenticado no tiene un registro de socio.');
    }

    const usuario = await this.usuariosService.obtenerPorId(usuarioId);

    const secreto = authenticator.generateSecret();
    const secretoCifrado = cifrarAesGcm(secreto, this.claveCifrado());
    await this.sociosService.activarTotp(usuarioId, secretoCifrado);

    return {
      qrUri: authenticator.keyuri(usuario.email, ISSUER, secreto),
      mensaje: 'Escaneá el QR con tu app de autenticación',
    };
  }

  // Llamado desde IngresosService (M2) al registrar un ingreso, ahora por socio.
  // `codigo_totp` es obligatorio en el DTO, pero solo se verifica contra un
  // secreto real si el socio activo el QR (totpSecreto + qrActivo); si nunca lo
  // activo se permite igual (backward compatibility explicita del plan), asi que
  // un socio sin TOTP no se ve afectado por este cambio.
  async validarIngreso(socioId: number, codigo: string): Promise<void> {
    const estado = await this.sociosService.obtenerEstadoTotpPorSocio(socioId);
    if (!estado || !estado.totpSecreto || !estado.qrActivo) {
      return;
    }

    const secreto = descifrarAesGcm(estado.totpSecreto, this.claveCifrado());
    const esValido = authenticator.verify({ token: codigo, secret: secreto });
    if (!esValido) {
      throw totpInvalido();
    }
  }

  private claveCifrado(): string {
    const clave = this.configService.get<string>('TOTP_ENCRYPTION_KEY');
    if (!clave) {
      throw claveTotpNoConfigurada();
    }
    return clave;
  }
}
