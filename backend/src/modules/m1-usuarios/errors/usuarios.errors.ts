import {
  ProblemException,
  conflictoDeDominio,
  datosInvalidos,
  recursoNoEncontrado,
} from '../../../commons/filters/problem.exception';

// El alta de un recepcionista (A3) es la unica operacion que escribe EmpleadoSede:
// el DTO acepta `sedeId` para todos porque la obligatoriedad depende del rol y
// class-validator valida campo por campo. Estos tres errores son esa regla.

// 422: falta la sede que el rol RECEPCION necesita para tener puesto de trabajo.
export function recepcionSinSede(): ProblemException {
  return datosInvalidos('Un usuario con rol RECEPCION requiere sedeId (sede de trabajo).');
}

// 422: EXTERNO y GERENTE no tienen fila en EmpleadoSede (ver fitzone.dbml: "viven
// solo en rol"). Enviar sede para ellos suele ser un error del cliente.
export function sedeSoloParaRecepcion(rol: string): ProblemException {
  return datosInvalidos(`El rol ${rol} no lleva sede de trabajo; sedeId solo aplica a RECEPCION.`);
}

// 404: la sede referenciada no existe.
export function sedeInexistente(sedeId: number): ProblemException {
  return recursoNoEncontrado(`No existe la sede ${sedeId}.`);
}

// 409: EmpleadoSede.sede_id es unico (1:1 con Sede): una sede ya tiene a su
// recepcionista. Es la regla de negocio, no un detalle de la base.
export function sedeConRecepcionista(sedeId: number): ProblemException {
  return conflictoDeDominio(
    'La sede ya tiene un recepcionista',
    `La sede ${sedeId} ya tiene un recepcionista asignado. Una sede admite a lo sumo uno (EmpleadoSede).`,
  );
}
