import { describe, expect, it } from 'vitest';
import type { ContextoDePrecio } from 'src/modules/m4-canchas/pricing/contexto-de-precio';
import { DescuentoSocio } from 'src/modules/m4-canchas/pricing/descuento-socio.regla';
import { RecargoHorarioPico } from 'src/modules/m4-canchas/pricing/recargo-horario-pico.regla';

function ctx(
  parcial: Partial<ContextoDePrecio> & Pick<ContextoDePrecio, 'inicio' | 'fin'>,
): ContextoDePrecio {
  return { costoBase: 5000, socioVigente: false, ...parcial };
}

// Cada regla se prueba SOLA: aplica (me toca) y aplicar (como transforma), sin
// contenedor, sin base y sin red (RF-11 / ADR-06).
describe('DescuentoSocio (RN-03)', () => {
  const regla = new DescuentoSocio();
  const fueraDePico = {
    inicio: new Date('2026-10-01T10:00:00-03:00'),
    fin: new Date('2026-10-01T11:00:00-03:00'),
  };

  it('aplica solo si el socio esta vigente', () => {
    expect(regla.aplica(ctx({ socioVigente: true, ...fueraDePico }))).toBe(true);
    expect(regla.aplica(ctx({ socioVigente: false, ...fueraDePico }))).toBe(false);
  });

  it('aplica el 15% sobre el precio acumulado', () => {
    expect(regla.aplicar(5000, ctx({ socioVigente: true, ...fueraDePico }))).toBeCloseTo(4250, 5);
  });
});

describe('RecargoHorarioPico', () => {
  const regla = new RecargoHorarioPico();

  it('aplica si el turno EMPIEZA dentro de la franja (19:30)', () => {
    expect(
      regla.aplica(
        ctx({
          inicio: new Date('2026-10-01T19:30:00-03:00'),
          fin: new Date('2026-10-01T20:30:00-03:00'),
        }),
      ),
    ).toBe(true);
  });

  it('aplica si CUBRE toda la franja (18:00-22:00)', () => {
    expect(
      regla.aplica(
        ctx({
          inicio: new Date('2026-10-01T18:00:00-03:00'),
          fin: new Date('2026-10-01T22:00:00-03:00'),
        }),
      ),
    ).toBe(true);
  });

  it('no aplica si el turno solo TERMINA dentro de la franja (18:30-19:30)', () => {
    expect(
      regla.aplica(
        ctx({
          inicio: new Date('2026-10-01T18:30:00-03:00'),
          fin: new Date('2026-10-01T19:30:00-03:00'),
        }),
      ),
    ).toBe(false);
  });

  it('no aplica a las 21:00 exactas (ventana medio-abierta)', () => {
    expect(
      regla.aplica(
        ctx({
          inicio: new Date('2026-10-01T21:00:00-03:00'),
          fin: new Date('2026-10-01T22:00:00-03:00'),
        }),
      ),
    ).toBe(false);
  });

  it('aplica el 20% sobre el precio acumulado', () => {
    expect(
      regla.aplicar(
        5000,
        ctx({
          inicio: new Date('2026-10-01T19:30:00-03:00'),
          fin: new Date('2026-10-01T20:30:00-03:00'),
        }),
      ),
    ).toBeCloseTo(6000, 5);
  });
});
