import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITMO = 'aes-256-gcm';
const IV_BYTES = 12; // recomendado por GCM; 96 bits
const KEY_BYTES = 32; // AES-256

// Cifra/descifra el secreto TOTP del socio (RF-04 QR dinamico). El formato
// persistido es `iv:authTag:cifrado`, todo en base64, para que una sola
// columna String alcance sin tabla aparte ni columnas extra por campo.
export function cifrarAesGcm(claro: string, claveBase64: string): string {
  const clave = clavePorFuerza(claveBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITMO, clave, iv);
  const cifrado = Buffer.concat([cipher.update(claro, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, cifrado].map((b) => b.toString('base64')).join(':');
}

export function descifrarAesGcm(valorCifrado: string, claveBase64: string): string {
  const [ivB64, authTagB64, cifradoB64] = valorCifrado.split(':');
  if (!ivB64 || !authTagB64 || !cifradoB64) {
    throw new Error('Formato de secreto cifrado inválido.');
  }
  const clave = clavePorFuerza(claveBase64);
  const decipher = createDecipheriv(ALGORITMO, clave, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const claro = Buffer.concat([
    decipher.update(Buffer.from(cifradoB64, 'base64')),
    decipher.final(),
  ]);
  return claro.toString('utf8');
}

// AES-256 exige exactamente 32 bytes de clave. Si TOTP_ENCRYPTION_KEY no
// decodifica a 32 bytes (p.ej. un valor de desarrollo mal copiado), se corta
// temprano con un mensaje claro en vez de que node tire el error críptico de
// OpenSSL ("Invalid key length").
function clavePorFuerza(claveBase64: string): Buffer {
  const clave = Buffer.from(claveBase64, 'base64');
  if (clave.length !== KEY_BYTES) {
    throw new Error(
      `TOTP_ENCRYPTION_KEY debe decodificar a ${KEY_BYTES} bytes en base64 (tiene ${clave.length}).`,
    );
  }
  return clave;
}
