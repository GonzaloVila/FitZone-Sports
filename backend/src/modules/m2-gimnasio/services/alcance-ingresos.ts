import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { ingresoFueraDeSede, sedeFueraDeAlcance } from '../errors/ingresos.errors';

// Regla de alcance por sede de M2, en un solo lugar y sin dependencias (funciones puras):
//  - RECEPCION trabaja en una sola sede (la del JWT, que sale de EmpleadoSede) y solo opera en esa.
//  - GERENTE opera en cualquier sede.
// Un RECEPCION sin sede asignada (`sedeId` undefined) no coincide con ninguna: queda afuera de todo, como en el egreso.
// El listado de ingresos no pasa por acá: fuerza el filtro de sede en IngresosService.listar.
export type ActorConSede = Pick<UsuarioAutenticado, 'rol' | 'sedeId'>;

// true si quien consulta es un RECEPCION y la sede no es la suya. Es la comparación que ya hacía el egreso.
export function recepcionFueraDeSede(actor: ActorConSede, sedeId: number): boolean {
  return actor.rol === 'RECEPCION' && actor.sedeId !== sedeId;
}

// 403 si la sede (aforo, alta de ingreso) es de otra y quien opera es RECEPCION.
export function exigirSedePropia(actor: ActorConSede, sedeId: number): void {
  if (recepcionFueraDeSede(actor, sedeId)) {
    throw sedeFueraDeAlcance(sedeId);
  }
}

// 403 si el ingreso es de otra sede y quien consulta es RECEPCION (mismo texto que el egreso).
export function exigirIngresoDeSuSede(actor: ActorConSede, ingresoId: number, sedeIdDelIngreso: number): void {
  if (recepcionFueraDeSede(actor, sedeIdDelIngreso)) {
    throw ingresoFueraDeSede(ingresoId);
  }
}
