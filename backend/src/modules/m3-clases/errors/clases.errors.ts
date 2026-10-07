import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../commons/filters/problem.exception';

export function horarioInvalido(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/fecha-invalida',
    title: 'Horario inválido',
    status: HttpStatus.CONFLICT,
    detail: 'El formato de fecha y hora no corresponde a un ISO-8601 válido.',
  });
}

export function claseEnHorarioPasado(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/clase-pasada',
    title: 'Clase en horario pasado',
    status: HttpStatus.CONFLICT,
    detail: 'No se puede programar una clase en una fecha u hora pasada.',
  });
}
