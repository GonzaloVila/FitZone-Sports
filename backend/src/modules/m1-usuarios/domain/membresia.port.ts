import type {
  EstadoMembresia,
  Membresia,
  MembresiaActualizable,
  MembresiaNoVigente,
  MembresiaRenovable,
  PlanMembresia,
} from '../entities/membresia.entity';

// Lo unico que M5 necesita de una membresia para cobrar: el precio congelado, el
// plan, de quien es y en que estado esta. `MembresiaOut` no sirve para esto (expone
// el plan pero ni el precio ni el usuario) y no se va a ampliar el DTO de la API
// para meterle el precio a M5 por la puerta de atras. La membresia no tiene
// usuarioId, lo tiene el socio: el cruce lo resuelve el adaptador, adentro de M1.
export interface MembresiaParaCobro {
  membresiaId: number;
  usuarioId: number;
  plan: PlanMembresia;
  precio: number;
  estado: EstadoMembresia;
}

// Repositorio de dominio (Fowler) de la membresia. Es una abstract class y no una
// interface para que sirva de token de inyeccion de Nest sin un string aparte: el
// equivalente de `interface MembresiaRepository extends JpaRepository`. Los
// services dependen de este puerto; el adaptador de Prisma se registra con
// { provide: MembresiaRepository, useClass: PrismaMembresiaRepository }.
export abstract class MembresiaRepository {
  abstract buscarPorSocioId(socioId: number): Promise<Membresia | null>;

  // Lectura minima para el caso de uso de cobro. Va en M1 y no en el service de M5
  // para que la tabla Membresia se consulte desde un solo lugar (ADR-07).
  abstract obtenerParaCobro(membresiaId: number): Promise<MembresiaParaCobro | null>;

  abstract actualizar(socioId: number, cambios: MembresiaActualizable): Promise<Membresia | null>;

  abstract marcarVencidas(): Promise<number>;

  // GET /bloqueados: no vigentes cuyo `updated_at` cambio desde `desde`.
  abstract buscarNoVigentes(desde: Date): Promise<MembresiaNoVigente[]>;

  // RF-02 (cron de M5): renovacion automatica habilitada y periodo vencido.
  abstract listarRenovables(ahora: Date): Promise<MembresiaRenovable[]>;

  // RF-02: extiende el periodo de una membresia renovada. null si la fila no existe.
  abstract renovar(
    id: number,
    periodo: { fechaInicio: Date; fechaFin: Date },
  ): Promise<Membresia | null>;
}
