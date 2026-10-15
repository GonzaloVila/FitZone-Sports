import { describe, expect, it } from 'vitest';
import type { ContextoDePrecio } from 'src/modules/m4-canchas/pricing/contexto-de-precio';
import { DescuentoSocio } from 'src/modules/m4-canchas/pricing/descuento-socio.regla';
import { RecargoHorarioPico } from 'src/modules/m4-canchas/pricing/recargo-horario-pico.regla';
import { TarifadorDePrecios } from 'src/modules/m4-canchas/pricing/tarifador-de-precios';

// Horarios con offset explicito -03:00 (Buenos Aires no observa horario de verano):
// representan sin ambiguedad la hora local de la sede, sin depender del TZ del entorno.
function ctx(
  parcial: Partial<ContextoDePrecio> & Pick<ContextoDePrecio, 'inicio' | 'fin'>,
): ContextoDePrecio {
  return { costoBase: 5000, socioVigente: false, ...parcial };
}

// Mismo orden que arma el useFactory del modulo: [descuentoSocio, recargoPico].
const tarifador = new TarifadorDePrecios([new DescuentoSocio(), new RecargoHorarioPico()]);

describe('TarifadorDePrecios (RF-11)', () => {
  it('externo fuera de pico: sin cambios', () => {
    const precio = tarifador.cotizar(
      ctx({
        socioVigente: false,
        inicio: new Date('2026-10-01T10:00:00-03:00'),
        fin: new Date('2026-10-01T11:00:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(5000, 5);
  });

  it('socio fuera de pico: 15% de descuento', () => {
    const precio = tarifador.cotizar(
      ctx({
        socioVigente: true,
        inicio: new Date('2026-10-01T10:00:00-03:00'),
        fin: new Date('2026-10-01T11:00:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(4250, 5);
  });

  it('socio en horario pico: descuento y recargo acumulados (0.85 x 1.20 x 5000)', () => {
    const precio = tarifador.cotizar(
      ctx({
        socioVigente: true,
        inicio: new Date('2026-10-01T19:30:00-03:00'),
        fin: new Date('2026-10-01T20:30:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(5100, 5);
  });

  it('externo en horario pico: solo recargo (1.20 x 5000, sin descuento)', () => {
    const precio = tarifador.cotizar(
      ctx({
        socioVigente: false,
        inicio: new Date('2026-10-01T19:30:00-03:00'),
        fin: new Date('2026-10-01T20:30:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(6000, 5);
  });

  it('no es pico si el turno solo TERMINA dentro de la franja: cuenta el inicio', () => {
    const precio = tarifador.cotizar(
      ctx({
        socioVigente: false,
        inicio: new Date('2026-10-01T18:30:00-03:00'),
        fin: new Date('2026-10-01T19:30:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(5000, 5);
  });

  it('turno que arranca exactamente a las 21:00: ventana medio-abierta, sin recargo de pico', () => {
    const precio = tarifador.cotizar(
      ctx({
        socioVigente: true,
        inicio: new Date('2026-10-01T21:00:00-03:00'),
        fin: new Date('2026-10-01T22:00:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(4250, 5);
  });

  it('cubre TODA la franja pico (18:00-22:00): recargo aunque no empiece dentro', () => {
    const precio = tarifador.cotizar(
      ctx({
        socioVigente: false,
        inicio: new Date('2026-10-01T18:00:00-03:00'),
        fin: new Date('2026-10-01T22:00:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(6000, 5);
  });

  it('cubre toda la franja pico con socio: recargo y descuento acumulados', () => {
    const precio = tarifador.cotizar(
      ctx({
        socioVigente: true,
        inicio: new Date('2026-10-01T18:00:00-03:00'),
        fin: new Date('2026-10-01T22:00:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(5100, 5);
  });

  it('franja exacta (19:00-21:00): recargo', () => {
    const precio = tarifador.cotizar(
      ctx({
        socioVigente: false,
        inicio: new Date('2026-10-01T19:00:00-03:00'),
        fin: new Date('2026-10-01T21:00:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(6000, 5);
  });

  it('NO cubre la franja entera (18:00-20:00): sin recargo', () => {
    const precio = tarifador.cotizar(
      ctx({
        socioVigente: false,
        inicio: new Date('2026-10-01T18:00:00-03:00'),
        fin: new Date('2026-10-01T20:00:00-03:00'),
      }),
    );
    expect(precio).toBeCloseTo(5000, 5);
  });
});
