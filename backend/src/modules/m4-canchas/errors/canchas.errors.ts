import { ProblemException, datosInvalidos } from '../../../commons/filters/problem.exception';

// PATCH de cancha sin campos: Prisma 6 trata un update vacio como no-op y
// responderia 200, asi que el service corta con el 422 que declara el contrato.
export function canchaSinCamposParaModificar(): ProblemException {
  return datosInvalidos('Se debe enviar al menos un campo: costo_por_hora o estado.');
}
