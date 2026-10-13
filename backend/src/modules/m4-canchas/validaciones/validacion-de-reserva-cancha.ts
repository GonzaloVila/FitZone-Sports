import type { Cancha } from '../entities/cancha.entity';

// Contexto ya leído por el service: los validadores DECIDEN, no consultan la base.
export interface ContextoReservaCancha {
  cancha: Cancha | null;
  inicio: Date;
  fin: Date;
}

// Eslabón de la cadena de validaciones previas a la reserva de cancha
// (Chain of Responsibility, variante "pipeline"). El solape (RN-02) NO es un
// eslabón: lo arbitra la constraint de exclusión en la base, no un chequeo previo.
export interface ValidacionDeReservaCancha {
  validar(ctx: ContextoReservaCancha): void;
}

// Token de la colección ordenada de validaciones, armada con `useFactory` en el módulo.
export const VALIDACIONES_RESERVA_CANCHA = Symbol('VALIDACIONES_RESERVA_CANCHA');
