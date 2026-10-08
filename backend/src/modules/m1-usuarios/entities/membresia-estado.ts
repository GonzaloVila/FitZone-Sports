// Máquina de estados de la membresía (patrón State, semana de refactor).
//
// Respuesta del catálogo a "¿qué soy ahora?": la membresía (ACTIVA / VENCIDA /
// SUSPENDIDA) cambia su comportamiento según el estado, y el cambio es un hecho
// de negocio auditable (el cron la vence, el admin la suspende/reactiva, la
// renovación la reactiva). Convive con Strategy: State decide qué se puede
// hacer; Strategy (pricing de M4) decide cómo se cobra.
//
// La persistencia (enum en BD) y el contrato (MembresiaOut.estado) no cambian:
// estos objetos solo deciden la transición; el adaptador de Prisma persiste el
// `.nombre` resultante y el consumo (consultarVigencia*) sigue igual.

import type { EstadoMembresia as NombreEstadoMembresia, Membresia } from './membresia.entity';

export interface EstadoMembresia {
  readonly nombre: NombreEstadoMembresia;
  // Vigencia real = fecha (RF-03/RN-03): el cron mueve `estado` a VENCIDA a
  // medianoche, pero entre la fechaFin y la corrida siguiente el registro sigue
  // ACTIVA. La única causa inmediata e irrevocable de no-vigencia es SUSPENDIDA;
  // el vencimiento se deriva de la fecha, que es la fuente de verdad del cobro.
  esVigente(m: Membresia, ahora?: Date): boolean;
  alVencer(m: Membresia, ahora: Date): EstadoMembresia; // cron diario
  alSuspender(): EstadoMembresia; // PATCH admin
  alReactivar(): EstadoMembresia; // PATCH admin
  alRenovar(): EstadoMembresia;   // RF-02 renovación
}

const ACTIVA: EstadoMembresia = {
  nombre: 'ACTIVA',
  esVigente: (m, ahora = new Date()) => m.fechaFin.getTime() >= ahora.getTime(),
  alVencer: (m, ahora) => (m.fechaFin.getTime() < ahora.getTime() ? VENCIDA : ACTIVA),
  alSuspender: () => SUSPENDIDA,
  alReactivar: () => ACTIVA,
  alRenovar: () => ACTIVA,
};

const VENCIDA: EstadoMembresia = {
  nombre: 'VENCIDA',
  esVigente: () => false,
  alVencer: () => VENCIDA,
  alSuspender: () => SUSPENDIDA,
  alReactivar: () => ACTIVA,
  alRenovar: () => ACTIVA,
};

// Irrevocable como transición de admin a admin: el cron jamás la toca (no
// renueva; listarRenovables excluye SUSPENDIDA).
const SUSPENDIDA: EstadoMembresia = {
  nombre: 'SUSPENDIDA',
  esVigente: () => false,
  alVencer: () => SUSPENDIDA,
  alSuspender: () => SUSPENDIDA,
  alReactivar: () => ACTIVA,
  alRenovar: () => SUSPENDIDA,
};

export function estadoDe(m: { estado: NombreEstadoMembresia }): EstadoMembresia {
  switch (m.estado) {
    case 'ACTIVA':
      return ACTIVA;
    case 'VENCIDA':
      return VENCIDA;
    case 'SUSPENDIDA':
      return SUSPENDIDA;
  }
}