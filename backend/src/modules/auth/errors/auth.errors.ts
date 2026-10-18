import { HttpStatus } from '@nestjs/common';
import { GENERIC_TYPE, ProblemException, TITLES } from '../../../commons/filters/problem.exception';

export function credencialesInvalidas(): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: TITLES[HttpStatus.UNAUTHORIZED],
    status: HttpStatus.UNAUTHORIZED,
    detail: 'Email o contraseña incorrectos.',
  });
}

export function totpInvalido(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/totp-invalido',
    title: 'Código TOTP inválido',
    status: HttpStatus.FORBIDDEN,
    detail: 'El código de verificación expiró o es incorrecto.',
  });
}

export function claveTotpNoConfigurada(): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: TITLES[HttpStatus.INTERNAL_SERVER_ERROR],
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    detail: 'Falta configurar TOTP_ENCRYPTION_KEY.',
  });
}

// Un unico 401 para cualquier falla del refresh token (inexistente, vencido,
// revocado o reusado): la respuesta no tiene que decirle al cliente cual fue.
export function sesionInvalida(): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: TITLES[HttpStatus.UNAUTHORIZED],
    status: HttpStatus.UNAUTHORIZED,
    detail: 'La sesión no es válida o expiró. Iniciá sesión de nuevo.',
  });
}

export function origenNoPermitido(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/origen-no-permitido',
    title: 'Origen no permitido',
    status: HttpStatus.FORBIDDEN,
    detail: 'El header Origin falta o no está entre los orígenes permitidos para renovar o cerrar la sesión por cookie.',
  });
}
