import {
  ProblemException,
  conflictoDeDominio,
  datosInvalidos,
} from '../../../commons/filters/problem.exception';

export function usuarioYaEsSocio(usuarioId: number): ProblemException {
  return conflictoDeDominio(
    'El usuario ya es socio',
    `El usuario ${usuarioId} ya tiene un registro de socio.`,
  );
}

// 409 de unicidad del alta de usuario. El `detail` nombra el campo repetido.
export function usuarioDuplicado(detail: string): ProblemException {
  return conflictoDeDominio('Conflicto de unicidad', detail);
}

// PATCH sin campos: Prisma 6 trata un update vacio como no-op y responderia 200, asi
// que el service corta con el 422 que declara el contrato.
export function sinCamposParaModificar(): ProblemException {
  return datosInvalidos('Se debe enviar al menos un campo para modificar.');
}
