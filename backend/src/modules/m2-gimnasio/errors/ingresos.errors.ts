import { HttpStatus } from '@nestjs/common';
import {
  GENERIC_TYPE,
  ProblemException,
  TITLES,
} from '../../../commons/filters/problem.exception';

export function membresiaInactiva(socioId: number, sedeId: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/membresia-inactiva',
    title: 'Membresía inactiva',
    status: HttpStatus.FORBIDDEN,
    detail: `El socio ${socioId} no posee una membresía vigente para ingresar a la sede ${sedeId}.`,
  });
}

// 409 acceso-duplicado (RN-01), compartido entre el atajo previo y el que
// devuelve el indice unico, para que los dos caminos emitan la misma problem+json.
export function accesoDuplicado(socioId: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/acceso-duplicado',
    title: 'Acceso duplicado',
    status: HttpStatus.CONFLICT,
    detail: `El socio ${socioId} ya tiene un ingreso sin egreso registrado (RN-01).`,
  });
}

export function aforoLleno(sedeId: number, aforoMaximo: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/aforo-lleno',
    title: 'Aforo de la sede completo',
    status: HttpStatus.CONFLICT,
    detail: `La sede ${sedeId} alcanzó su aforo máximo (${aforoMaximo} personas); no se admiten más ingresos (RF-05).`,
  });
}

export function egresoFueraDeSede(ingresoId: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/egreso-fuera-de-sede',
    title: 'Egreso fuera de la sede',
    status: HttpStatus.FORBIDDEN,
    detail: `El ingreso ${ingresoId} no pertenece a la sede del recepcionista.`,
  });
}

export function egresoDuplicado(ingresoId: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/egreso-duplicado',
    title: 'Egreso duplicado',
    status: HttpStatus.CONFLICT,
    detail: `El ingreso ${ingresoId} ya tiene fecha_hora_egreso; no se puede egresar dos veces.`,
  });
}

// Sincronizacion offline (RNF-01): el lote se registra en la sede del empleado, asi
// que sin EmpleadoSede no hay sede a la que imputarlo.
export function sinSedeAsignada(): ProblemException {
  return new ProblemException({
    type: GENERIC_TYPE,
    title: TITLES[HttpStatus.FORBIDDEN],
    status: HttpStatus.FORBIDDEN,
    detail: 'El usuario autenticado no tiene una sede de trabajo asignada (EmpleadoSede).',
  });
}
