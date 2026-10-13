import type { Clase } from '../entities/clase.entity';

// Contexto ya leído por el service: los validadores DECIDEN, no consultan la base.
// Así cada eslabón es una pieza pura y testeable, y la cadena se lee en un lugar.
export interface ContextoReserva {
  claseId: number;
  socioId: number;
  clase: Clase | null;
  estadoSocio: {
    esSocio: boolean;
    vigente: boolean;
    enMora: boolean;
  };
}

// Un eslabón de la cadena de validaciones previas a la reserva de clase
// (Chain of Responsibility, variante "pipeline": corren en orden y el primero que
// encuentra una violación la lanza). Agregar una validación es agregar una clase
// y registrarla en el módulo; ningún otro archivo se toca (Open/Closed).
export interface ValidacionDeReserva {
  validar(ctx: ContextoReserva): void;
}

// Token de la colección ordenada de validaciones. En NestJS el token de colección
// se declara con `useFactory` en el módulo (a diferencia de Spring, que inyecta
// `List<ValidacionDeReserva>` sola).
export const VALIDACIONES_RESERVA = Symbol('VALIDACIONES_RESERVA');
