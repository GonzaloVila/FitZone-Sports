import { HttpStatus } from '@nestjs/common';
import { ProblemException } from '../../../commons/filters/problem.exception';

export function socioEnMoraParaReserva(socioId: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/socio-en-mora',
    title: 'Socio en mora',
    status: HttpStatus.FORBIDDEN,
    detail: `El socio ${socioId} posee cuotas vencidas. No puede reservar con tarifa bonificada. Puede abonar el precio de cliente externo.`,
  });
}

export function reservaAnticipadaNoPermitida(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/reserva-anticipada-no-permitida',
    title: 'Reserva anticipada no permitida',
    status: HttpStatus.CONFLICT,
    detail: 'Las reservas de clases solo se habilitan dentro de las 48 horas previas al inicio.',
  });
}

export function claseNoDisponibleParaReserva(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/clase-pasada',
    title: 'Clase no disponible',
    status: HttpStatus.CONFLICT,
    detail: 'No es posible reservar una clase que ya comenzó o ha finalizado.',
  });
}

export function cupoAgotado(claseId: number, capacidad: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/cupo-agotado',
    title: 'Cupo de clase agotado',
    status: HttpStatus.CONFLICT,
    detail: `La clase ${claseId} alcanzó su capacidad máxima (${capacidad}). Puede ingresar a la lista de espera (RF-08).`,
  });
}

export function reservaDuplicada(socioId: number, claseId: number): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/reserva-duplicada',
    title: 'Reserva duplicada',
    status: HttpStatus.CONFLICT,
    detail: `El socio ${socioId} ya posee una reserva confirmada para la clase ${claseId}.`,
  });
}

export function cancelacionFueraDeTermino(): ProblemException {
  return new ProblemException({
    type: 'https://fitzone.app/errores/cancelacion-fuera-de-termino',
    title: 'Cancelación fuera de término',
    status: HttpStatus.CONFLICT,
    detail: 'No es posible cancelar la reserva sin penalidad con menos de 2 horas de anticipación.',
  });
}
