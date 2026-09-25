import type { InjectionToken } from '@nestjs/common';
import type { Ingreso, IngresoNuevo } from '../entities/ingreso.entity';

export const INGRESO_REPOSITORY: InjectionToken = 'INGRESO_REPOSITORY';

// Resultado discriminado en vez de lanzar: tanto "aforo lleno" (RF-05) como
// "acceso duplicado" (RN-01) son reglas de negocio esperadas del flujo, no
// errores de infraestructura, y solo el propio crear() puede detectarlas de
// forma atómica. Devolverlas como dato evita que el service repita el conteo
// por fuera y reabra la ventana de carrera.
//
// - AFORO_LLENO: se decide acá adentro con el lock pesimista sobre Sede + count
//   + insert en una sola transacción (ADR-08 D5).
// - ACCESO_DUPLICADO: llega desde la base. El índice parcial único
//   ingreso_usuario_abierto_unq (ver migración 20260925010000) rechaza el
//   segundo INSERT abierto del mismo usuario, así que el P2002 que Prisma
//   levanta es la garantía de RN-01, no un fallo. El service igual mantiene un
//   chequeo previo por fuera de la transacción para el caso común, que es el
//   que da el 409 legible sin depender del error.
export type ResultadoCrearIngreso =
  | { ok: true; ingreso: Ingreso }
  | { ok: false; motivo: 'AFORO_LLENO' | 'ACCESO_DUPLICADO' };

export interface IngresoRepository {
  crear(ingreso: IngresoNuevo): Promise<ResultadoCrearIngreso>;
  buscarPorId(id: number): Promise<Ingreso | null>;
  buscarActivoPorUsuario(usuarioId: number): Promise<Ingreso | null>;
  marcarEgreso(id: number, fecha: Date): Promise<Ingreso | null>;
  contarActivosPorSede(sedeId: number): Promise<number>;
}
