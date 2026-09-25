import type { InjectionToken } from '@nestjs/common';
import type { Ingreso, IngresoNuevo } from '../entities/ingreso.entity';

export const INGRESO_REPOSITORY: InjectionToken = 'INGRESO_REPOSITORY';

// Resultado discriminado en vez de lanzar: "aforo lleno" es una regla de
// negocio esperada del flujo (RF-05), no un error de infraestructura, y solo
// el propio crear() puede detectarla de forma atómica (lock + count + insert
// en una sola transacción, ADR-08 D5). Devolverla como dato evita que el
// service repita el conteo por fuera y reabra la ventana de carrera.
export type ResultadoCrearIngreso =
  | { ok: true; ingreso: Ingreso }
  | { ok: false; motivo: 'AFORO_LLENO' };

export interface IngresoRepository {
  crear(ingreso: IngresoNuevo): Promise<ResultadoCrearIngreso>;
  buscarPorId(id: number): Promise<Ingreso | null>;
  buscarActivoPorUsuario(usuarioId: number): Promise<Ingreso | null>;
  marcarEgreso(id: number, fecha: Date): Promise<Ingreso | null>;
  contarActivosPorSede(sedeId: number): Promise<number>;
}
