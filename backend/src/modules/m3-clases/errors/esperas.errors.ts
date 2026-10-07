import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../commons/filters/problem.exception';

export function claseNoDisponibleParaEspera(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/clase-pasada',
    title: 'Clase no disponible',
    status: HttpStatus.CONFLICT,
    detail: 'No es posible anotarse en espera para una clase que ya comenzó o ha finalizado.',
  });
}

export function socioEnMoraParaEspera(socioId: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/socio-en-mora',
    title: 'Socio en mora',
    status: HttpStatus.FORBIDDEN,
    detail: `El socio ${socioId} posee cuotas vencidas. No puede ingresar a la lista de espera de clases bonificadas.`,
  });
}

export function cupoDisponible(claseId: number, lugares: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/cupo-disponible',
    title: 'Cupo disponible',
    status: HttpStatus.CONFLICT,
    detail: `La clase ${claseId} aún cuenta con lugares disponibles (${lugares}). Puede reservar directamente sin ingresar a la lista de espera.`,
  });
}

export function esperaExistente(socioId: number, claseId: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/espera-existente',
    title: 'Espera o reserva existente',
    status: HttpStatus.CONFLICT,
    detail: `El socio ${socioId} ya se encuentra inscripto en espera o ya posee una reserva confirmada para la clase ${claseId}.`,
  });
}

export function esperaConfirmada(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/espera-confirmada',
    title: 'Espera confirmada',
    status: HttpStatus.CONFLICT,
    detail: 'La solicitud de espera ya fue confirmada como reserva; debe gestionarse desde la cancelación de reservas.',
  });
}

export function esperaNoNotificada(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/espera-no-notificada',
    title: 'Confirmación rechazada',
    status: HttpStatus.CONFLICT,
    detail: 'No es posible confirmar la espera porque aún no ha sido notificada con un cupo disponible.',
  });
}

export function cupoTomado(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/cupo-tomado',
    title: 'Cupo liberado tomado',
    status: HttpStatus.CONFLICT,
    detail: 'El lugar liberado ya fue tomado por otro socio que confirmó primero (first-come).',
  });
}

// Tiene su propio detail (sin ids) y no reusa el de reservas-clases.errors: es el
// camino de confirmacion de una espera, no el de una reserva directa.
export function reservaDuplicadaAlConfirmar(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/reserva-duplicada',
    title: 'Reserva duplicada',
    status: HttpStatus.CONFLICT,
    detail: 'El socio ya posee una reserva confirmada para esta clase.',
  });
}
