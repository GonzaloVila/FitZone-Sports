import {
  ProblemException,
  datosInvalidos,
  recursoNoEncontrado,
} from '../../../commons/filters/problem.exception';

export function socioNoEncontrado(): ProblemException {
  return recursoNoEncontrado('No existe el socio indicado.');
}

export function socioSinMembresia(): ProblemException {
  return recursoNoEncontrado('El socio no posee una membresía activa.');
}

export function membresiaNoEncontrada(): ProblemException {
  return recursoNoEncontrado('No existe la membresía indicada.');
}

// Mismo criterio que sinCamposParaModificar() de socios.errors: un PATCH vacio es 422.
export function membresiaSinCamposParaModificar(): ProblemException {
  return datosInvalidos('Se debe enviar al menos un campo para modificar.');
}
