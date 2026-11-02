import { HttpStatus } from '@nestjs/common';
import { GENERIC_TYPE, ProblemException, TITLES } from '../../../commons/filters/problem.exception';

// 403: un SOCIO cuyo token no trae `socioId` (caso raro: el token es anterior al alta) no tiene "lo propio" contra lo que
// comparar, así que no accede a listados ni altas de clases. Nunca se le devuelven datos de otros.
export function sinSocioEnLaSesion(): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: TITLES[HttpStatus.FORBIDDEN],
    status: HttpStatus.FORBIDDEN,
    detail: 'La sesión no corresponde a un socio. Vuelva a iniciar sesión.',
  });
}
