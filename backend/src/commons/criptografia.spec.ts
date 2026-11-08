import { randomBytes } from 'crypto';
import { describe, expect, it } from 'vitest';
import { cifrarAesGcm, descifrarAesGcm } from './criptografia';

// Cifrado del secreto TOTP del socio (RF-04, QR dinamico) con AES-256-GCM.
const CLAVE = randomBytes(32).toString('base64');
const OTRA_CLAVE = randomBytes(32).toString('base64');
const SECRETO = 'JBSWY3DPEHPK3PXP';

describe('criptografia (AES-256-GCM del secreto TOTP)', () => {
  describe('ida y vuelta', () => {
    it('descifra exactamente lo que se cifro', () => {
      expect(descifrarAesGcm(cifrarAesGcm(SECRETO, CLAVE), CLAVE)).toBe(SECRETO);
    });

    it('conserva texto con caracteres fuera de ASCII', () => {
      const texto = 'contraseña con ñ y acentos: áéíóú';
      expect(descifrarAesGcm(cifrarAesGcm(texto, CLAVE), CLAVE)).toBe(texto);
    });

    it('persiste el formato iv:authTag:cifrado en base64, sin el texto claro', () => {
      const cifrado = cifrarAesGcm(SECRETO, CLAVE);
      const partes = cifrado.split(':');

      expect(partes).toHaveLength(3);
      expect(Buffer.from(partes[0], 'base64')).toHaveLength(12);
      expect(Buffer.from(partes[1], 'base64')).toHaveLength(16);
      expect(cifrado).not.toContain(SECRETO);
    });

    it('cifrar dos veces lo mismo da resultados distintos (IV aleatorio)', () => {
      expect(cifrarAesGcm(SECRETO, CLAVE)).not.toBe(cifrarAesGcm(SECRETO, CLAVE));
    });
  });

  describe('integridad', () => {
    it('no descifra con otra clave', () => {
      const cifrado = cifrarAesGcm(SECRETO, CLAVE);
      expect(() => descifrarAesGcm(cifrado, OTRA_CLAVE)).toThrow();
    });

    it('detecta un cifrado alterado (el authTag de GCM no cierra)', () => {
      const [iv, tag, datos] = cifrarAesGcm(SECRETO, CLAVE).split(':');
      const alterado = Buffer.from(datos, 'base64');
      alterado[0] ^= 0xff;

      expect(() => descifrarAesGcm([iv, tag, alterado.toString('base64')].join(':'), CLAVE)).toThrow();
    });

    it.each(['', 'solo-una-parte', 'dos:partes'])('rechaza un valor persistido sin las tres partes (%j)', (valor) => {
      expect(() => descifrarAesGcm(valor, CLAVE)).toThrow('Formato de secreto cifrado inválido.');
    });
  });

  describe('clave', () => {
    it('corta con un mensaje claro si la clave no decodifica a 32 bytes', () => {
      const corta = randomBytes(16).toString('base64');
      expect(() => cifrarAesGcm(SECRETO, corta)).toThrow('TOTP_ENCRYPTION_KEY debe decodificar a 32 bytes en base64 (tiene 16).');
    });

    it('aplica la misma validacion al descifrar', () => {
      const cifrado = cifrarAesGcm(SECRETO, CLAVE);
      expect(() => descifrarAesGcm(cifrado, '')).toThrow('TOTP_ENCRYPTION_KEY debe decodificar a 32 bytes');
    });
  });
});
