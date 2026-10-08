import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { rangoDelDia } from '../../../commons/fechas';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { DisponibilidadEntrada } from '../dtos/disponibilidad-entrada.dto';
import { Reserva } from '../entities/reserva.entity';
import { CanchaRepository } from '../repositories/cancha.repository';
import { ReservaRepository } from '../domain/reserva.port';
import {
  GRILLA_HORA_FIN,
  GRILLA_HORA_INICIO,
  GRILLA_PASO_MINUTOS,
} from './disponibilidad-constants';

const MINUTO_EN_MS = 60_000;

function aMinutos(hhmm: string): number {
  const [horas, minutos] = hhmm.split(':').map(Number);
  return horas * 60 + minutos;
}

@Injectable()
export class DisponibilidadService {
  constructor(
    private readonly canchas: CanchaRepository,
    private readonly reservas: ReservaRepository,
  ) {}

  async consultar(
    canchaId: number,
    fecha: string,
    { page, perPage }: { page: number; perPage: number },
  ): Promise<DisponibilidadEntrada[]> {
    const cancha = await this.canchas.buscarPorId(canchaId);
    if (!cancha) {
      throw recursoNoEncontrado('No existe la cancha indicada.');
    }

    const { desde, hasta } = rangoDelDia(fecha);
    const grilla = this.armarGrilla(desde);

    // RF-12: en mantenimiento todo el día está bloqueado; no hace falta leer
    // las reservas para saberlo.
    const bloqueada = cancha.estado === 'EN_MANTENIMIENTO';
    const ocupadas: Reserva[] = bloqueada
      ? []
      : await this.reservas.listarOcupadasEnRango(canchaId, desde, hasta);

    const entradas = grilla.map(({ inicio, fin }) => ({
      fechaHoraInicio: inicio,
      fechaHoraFin: fin,
      // Solapamiento de intervalos semiabiertos: un turno que termina justo
      // cuando empieza el tramo no lo ocupa (mismo criterio que la constraint de exclusion de RN-02).
      disponible:
        !bloqueada &&
        !ocupadas.some(
          (r) =>
            r.fechaHoraInicio.getTime() < fin.getTime() &&
            r.fechaHoraFin.getTime() > inicio.getTime(),
        ),
    }));

    const pagina = entradas.slice((page - 1) * perPage, page * perPage);
    return pagina.map((entrada) => plainToInstance(DisponibilidadEntrada, entrada));
  }

  // La grilla se ancla en la medianoche local de la sede que devuelve
  // rangoDelDia() y suma minutos: así comparte con el filtro `fecha` de M2 la
  // misma definición de "día de la sede" (offset fijo -03:00, sin DST en
  // Argentina) en vez de convertir horas de pared con otra zona.
  private armarGrilla(medianoche: Date): { inicio: Date; fin: Date }[] {
    const tramos: { inicio: Date; fin: Date }[] = [];
    const ultimo = aMinutos(GRILLA_HORA_FIN);
    for (let minuto = aMinutos(GRILLA_HORA_INICIO); minuto + GRILLA_PASO_MINUTOS <= ultimo; minuto += GRILLA_PASO_MINUTOS) {
      tramos.push({
        inicio: new Date(medianoche.getTime() + minuto * MINUTO_EN_MS),
        fin: new Date(medianoche.getTime() + (minuto + GRILLA_PASO_MINUTOS) * MINUTO_EN_MS),
      });
    }
    return tramos;
  }
}
