import { HttpStatus } from '@nestjs/common';
import type { ProblemDetails } from '../filters/problem.exception';

/**
 * RN-02: el turno ya estaba tomado. El `type` y el `detail` son los que declara
 * el contrato en el ejemplo `turno-ocupado` de `ConflictoReservaCancha`. Vive
 * como funcion y no inline en el service para que la otra causa de 409 del
 * mismo endpoint (`cancha-en-mantenimiento`) no acabe reusando este texto, que
 * seria falso para ella: en mantenimiento no hubo concurrencia.
 *
 * Vive en commons y no en m4-canchas porque lo usan dos capas: el errors/ de M4
 * (`turnoOcupado()`) y el ProblemFilter global (red de contencion de la
 * constraint de exclusion), y commons no puede depender de un modulo.
 */
export function turnoOcupadoBody(instance: string): ProblemDetails {
  return {
    type: 'https://fitzone.app/errores/turno-ocupado',
    title: 'El turno seleccionado ya fue reservado',
    status: HttpStatus.CONFLICT,
    detail: 'Otro usuario reservó el turno para esa fecha y hora antes que vos.',
    instance,
  };
}
