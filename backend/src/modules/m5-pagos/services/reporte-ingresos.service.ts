import { Injectable } from '@nestjs/common';
import { aFechaLocal } from '../../../commons/fechas';
import { ConceptoPago } from '../entities/pago.entity';
import { PagoRepository } from '../repositories/pago.repository';

export interface FilaReporte {
  fechaLocal: string;
  sedeId: number;
  sedeNombre: string;
  tipo: ConceptoPago['tipo'];
  monto: number;
}

export interface ReporteIngresos {
  filas: FilaReporte[];
  total: number;
  // Pagos APROBADO cuya sede no se pudo resolver (fila huérfana): se descartan del
  // consolidado y se cuentan aparte para no romper el reporte.
  huerfanos: number;
}

// Evita el ruido de coma flotante al sumar importes (0.1 + 0.2).
const aCentavos = (monto: number): number => Math.round(monto * 100);

/**
 * Read side del CQRS (Unidad IV): consolida los pagos APROBADO por día local de la
 * sede, sede y tipo de concepto. No transacciona nada.
 *
 * Decisión de implementación: la sede de cada pago se resuelve en TypeScript con los
 * includes anidados del repositorio (cancha→sede, socio→sede, clase→sede) y la
 * agregación también es en memoria. Para el alcance académico es la opción simple y
 * testeable con mocks; con volumen real convendría un GROUP BY en SQL.
 */
@Injectable()
export class ReporteIngresosService {
  constructor(private readonly pagos: PagoRepository) {}

  async consolidadoPagos({ desde, hasta }: { desde?: Date; hasta?: Date }): Promise<ReporteIngresos> {
    const pagos = await this.pagos.listarAprobadosConSede({ desde, hasta });

    const acumulado = new Map<string, FilaReporte & { centavos: number }>();
    let huerfanos = 0;

    for (const pago of pagos) {
      if (!pago.sede) {
        huerfanos += 1;
        continue;
      }
      const fechaLocal = aFechaLocal(pago.fechaPago);
      const clave = `${fechaLocal}|${pago.sede.id}|${pago.tipo}`;
      const fila = acumulado.get(clave) ?? {
        fechaLocal,
        sedeId: pago.sede.id,
        sedeNombre: pago.sede.nombre,
        tipo: pago.tipo,
        monto: 0,
        centavos: 0,
      };
      fila.centavos += aCentavos(pago.monto);
      acumulado.set(clave, fila);
    }

    const filas = [...acumulado.values()]
      .map(({ centavos, ...fila }) => ({ ...fila, monto: centavos / 100 }))
      .sort(
        (a, b) =>
          a.fechaLocal.localeCompare(b.fechaLocal) ||
          a.sedeId - b.sedeId ||
          a.tipo.localeCompare(b.tipo),
      );

    const total = filas.reduce((suma, fila) => suma + aCentavos(fila.monto), 0) / 100;

    return { filas, total, huerfanos };
  }
}
