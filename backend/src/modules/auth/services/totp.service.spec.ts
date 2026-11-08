import { randomBytes } from 'crypto';
import type { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cifrarAesGcm, descifrarAesGcm } from '../../../commons/criptografia';
import { ProblemException } from '../../../commons/filters/problem.exception';
import type { SociosService } from '../../m1-usuarios/services/socios.service';
import type { UsuariosService } from '../../m1-usuarios/services/usuarios.service';
import { TotpService } from './totp.service';

// RF-04 (QR dinamico): alta del secreto TOTP y validacion del codigo al ingresar. SociosService y UsuariosService van
// mockeados; el cifrado y otplib son los reales, porque son justamente lo que se quiere probar.
const CLAVE = randomBytes(32).toString('base64');

// clave null simula que TOTP_ENCRYPTION_KEY no esta configurada.
function armar(clave: string | null = CLAVE) {
  const socios = {
    obtenerEstadoTotp: vi.fn(),
    obtenerEstadoTotpPorSocio: vi.fn(),
    activarTotp: vi.fn().mockResolvedValue(undefined),
  };
  const usuarios = { obtenerPorId: vi.fn().mockResolvedValue({ id: 7, email: 'socio@fitzone.test' }) };
  const config = { get: vi.fn().mockReturnValue(clave ?? undefined) };
  const service = new TotpService(
    socios as unknown as SociosService,
    usuarios as unknown as UsuariosService,
    config as unknown as ConfigService,
  );
  return { service, socios, usuarios, config };
}

async function problemaDe(promesa: Promise<unknown>): Promise<ProblemException> {
  try {
    await promesa;
  } catch (error) {
    return error as ProblemException;
  }
  throw new Error('se esperaba un error');
}

describe('TotpService', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe('generarRegistro', () => {
    it('guarda el secreto cifrado y devuelve la URI otpauth con el email del socio', async () => {
      const { service, socios } = armar();
      socios.obtenerEstadoTotp.mockResolvedValue({ totpSecreto: null, qrActivo: false });

      const res = await service.generarRegistro(7);

      expect(res.mensaje).toBe('Escaneá el QR con tu app de autenticación');
      const uri = new URL(res.qrUri);
      expect(res.qrUri).toMatch(/^otpauth:\/\/totp\/FitZone:socio%40fitzone\.test\?/);
      expect(uri.searchParams.get('issuer')).toBe('FitZone');
      expect(uri.searchParams.get('digits')).toBe('6');
      expect(uri.searchParams.get('period')).toBe('30');
      expect(uri.searchParams.get('secret')).toMatch(/^[A-Z2-7]+$/);

      expect(socios.activarTotp).toHaveBeenCalledTimes(1);
      const [usuarioId, secretoCifrado] = socios.activarTotp.mock.calls[0] as [number, string];
      expect(usuarioId).toBe(7);
      // Lo que se persiste es el mismo secreto que viaja en la URI, pero cifrado.
      const secretoDeLaUri = new URL(res.qrUri).searchParams.get('secret');
      expect(secretoCifrado).not.toContain(secretoDeLaUri);
      expect(descifrarAesGcm(secretoCifrado, CLAVE)).toBe(secretoDeLaUri);
    });

    it('cada registro genera un secreto nuevo (pisa el anterior)', async () => {
      const { service, socios } = armar();
      socios.obtenerEstadoTotp.mockResolvedValue({ totpSecreto: 'viejo', qrActivo: true });

      const primero = new URL((await service.generarRegistro(7)).qrUri).searchParams.get('secret');
      const segundo = new URL((await service.generarRegistro(7)).qrUri).searchParams.get('secret');

      expect(primero).not.toBe(segundo);
    });

    it('responde 404 si el usuario no es socio, sin generar nada', async () => {
      const { service, socios } = armar();
      socios.obtenerEstadoTotp.mockResolvedValue(null);

      const error = await problemaDe(service.generarRegistro(7));

      expect(error.getStatus()).toBe(404);
      expect(socios.activarTotp).not.toHaveBeenCalled();
    });

    it('responde 500 si falta TOTP_ENCRYPTION_KEY, sin guardar el secreto en claro', async () => {
      const { service, socios } = armar(null);
      socios.obtenerEstadoTotp.mockResolvedValue({ totpSecreto: null, qrActivo: false });

      const error = await problemaDe(service.generarRegistro(7));

      expect(error.getStatus()).toBe(500);
      expect(socios.activarTotp).not.toHaveBeenCalled();
    });
  });

  describe('validarIngreso', () => {
    const secreto = authenticator.generateSecret();

    function socioConQr(service: ReturnType<typeof armar>) {
      service.socios.obtenerEstadoTotpPorSocio.mockResolvedValue({
        totpSecreto: cifrarAesGcm(secreto, CLAVE),
        qrActivo: true,
      });
    }

    it('acepta el codigo vigente del socio', async () => {
      const armado = armar();
      socioConQr(armado);

      await expect(armado.service.validarIngreso(3, authenticator.generate(secreto))).resolves.toBeUndefined();
    });

    it('rechaza un codigo incorrecto con 403 totp-invalido', async () => {
      const armado = armar();
      socioConQr(armado);
      const vigente = authenticator.generate(secreto);
      const incorrecto = vigente === '000000' ? '111111' : '000000';

      const error = await problemaDe(armado.service.validarIngreso(3, incorrecto));

      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toMatchObject({ type: 'https://fitzone.app/errores/totp-invalido' });
    });

    it('tolera un intervalo de desfase de reloj (window 1) pero no dos', async () => {
      const armado = armar();
      socioConQr(armado);
      vi.useFakeTimers();
      const ahora = new Date('2026-11-08T12:00:15Z');

      vi.setSystemTime(ahora.getTime() - 30_000);
      const delIntervaloAnterior = authenticator.generate(secreto);
      vi.setSystemTime(ahora.getTime() - 60_000);
      const deDosIntervalosAtras = authenticator.generate(secreto);
      vi.setSystemTime(ahora);

      await expect(armado.service.validarIngreso(3, delIntervaloAnterior)).resolves.toBeUndefined();
      expect((await problemaDe(armado.service.validarIngreso(3, deDosIntervalosAtras))).getStatus()).toBe(403);
    });

    it.each([
      ['no es socio', null],
      ['nunca activo el QR', { totpSecreto: null, qrActivo: false }],
      ['tiene secreto pero el QR esta desactivado', { totpSecreto: 'x:y:z', qrActivo: false }],
    ])('deja pasar sin verificar cuando %s (compatibilidad hacia atras)', async (_caso, estado) => {
      const armado = armar();
      armado.socios.obtenerEstadoTotpPorSocio.mockResolvedValue(estado);

      await expect(armado.service.validarIngreso(3, '000000')).resolves.toBeUndefined();
      expect(armado.config.get).not.toHaveBeenCalled();
    });
  });
});
