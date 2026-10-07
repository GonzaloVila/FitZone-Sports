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
