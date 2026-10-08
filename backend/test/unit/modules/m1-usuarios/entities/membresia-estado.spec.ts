import { describe, expect, it } from 'vitest';
import { PRECIOS_PLAN } from 'src/modules/m1-usuarios/entities/membresia.entity';
import type { Membresia } from 'src/modules/m1-usuarios/entities/membresia.entity';
import { estadoDe } from 'src/modules/m1-usuarios/entities/membresia-estado';

// La regla de vigencia vivia en `estaVigente()` (entity) y se usaba en los
// services con `if` dispersos. El refactor a State la movio a objetos de estado
// (membresia-estado.ts): estos tests fijan la combinacion estado x fechaFin y
// todas las transiciones, que es el comportamiento sensible que consumen
// M2 (ingreso), M3 (reservas), M4 (precio) y M5 (renovacion).

function membresia(over: Partial<Membresia> = {}): Membresia {
  return {
    id: 1,
    socioId: 1,
    plan: 'MENSUAL',
    estado: 'ACTIVA',
    fechaInicio: new Date('2026-09-01T12:00:00.000Z'),
    fechaFin: new Date('2099-11-01T12:00:00.000Z'),
    precio: PRECIOS_PLAN.MENSUAL,
    renuevaAutomatica: true,
    updatedAt: new Date('2026-09-01T12:00:00.000Z'),
    ...over,
  };
}

const AHORA = new Date('2026-10-07T12:00:00.000Z');

describe('estadoDe - esVigente (RF-03 / RN-03)', () => {
  it('dispersa por estado', () => {
    expect(estadoDe(membresia()).nombre).toBe('ACTIVA');
    expect(estadoDe(membresia({ estado: 'VENCIDA' })).nombre).toBe('VENCIDA');
    expect(estadoDe(membresia({ estado: 'SUSPENDIDA' })).nombre).toBe('SUSPENDIDA');
  });

  it('ACTIVA con fecha_fin futura es vigente', () => {
    expect(estadoDe(membresia()).esVigente(membresia(), AHORA)).toBe(true);
  });

  // El cron vence a medianoche; entre la fechaFin y la corrida el registro
  // sigue ACTIVA. La fecha manda, no la etiqueta.
  it('ACTIVA con fecha_fin pasada NO es vigente', () => {
    const m = membresia({ fechaFin: new Date('2020-01-01T00:00:00.000Z') });
    expect(estadoDe(m).esVigente(m, AHORA)).toBe(false);
  });

  it('ACTIVA que termina exactamente ahora es vigente', () => {
    const m = membresia({ fechaFin: AHORA });
    expect(estadoDe(m).esVigente(m, AHORA)).toBe(true);
  });

  it('VENCIDA nunca es vigente', () => {
    const m = membresia({ estado: 'VENCIDA' });
    expect(estadoDe(m).esVigente(m, AHORA)).toBe(false);
  });

  it('SUSPENDIDA nunca es vigente (causa inmediata e irrevocable)', () => {
    const m = membresia({ estado: 'SUSPENDIDA' });
    expect(estadoDe(m).esVigente(m, AHORA)).toBe(false);
  });
});

describe('transiciones de estado', () => {
  describe('ACTIVA', () => {
    it('vence si la fecha ya paso; se mantiene si no', () => {
      const vencida = membresia({ fechaFin: new Date('2020-01-01T00:00:00.000Z') });
      expect(estadoDe(vencida).alVencer(vencida, AHORA).nombre).toBe('VENCIDA');
      expect(estadoDe(membresia()).alVencer(membresia(), AHORA).nombre).toBe('ACTIVA');
    });

    it('se suspende, reactivar es no-op y renovar la mantiene activa', () => {
      expect(estadoDe(membresia()).alSuspender().nombre).toBe('SUSPENDIDA');
      expect(estadoDe(membresia()).alReactivar().nombre).toBe('ACTIVA');
      expect(estadoDe(membresia()).alRenovar().nombre).toBe('ACTIVA');
    });
  });

  describe('VENCIDA', () => {
    it('el cron no la vuelve a tocar', () => {
      expect(estadoDe(membresia({ estado: 'VENCIDA' })).alVencer(membresia({ estado: 'VENCIDA' }), AHORA).nombre).toBe('VENCIDA');
    });

    it('se suspende, se reactiva o se renueva (tras cobro RF-02)', () => {
      expect(estadoDe(membresia({ estado: 'VENCIDA' })).alSuspender().nombre).toBe('SUSPENDIDA');
      expect(estadoDe(membresia({ estado: 'VENCIDA' })).alReactivar().nombre).toBe('ACTIVA');
      expect(estadoDe(membresia({ estado: 'VENCIDA' })).alRenovar().nombre).toBe('ACTIVA');
    });
  });

  describe('SUSPENDIDA', () => {
    it('es irrevocable salvo reactivacion del admin', () => {
      const suspendida = membresia({ estado: 'SUSPENDIDA' });
      expect(estadoDe(suspendida).alVencer(suspendida, AHORA).nombre).toBe('SUSPENDIDA');
      expect(estadoDe(suspendida).alSuspender().nombre).toBe('SUSPENDIDA');
      expect(estadoDe(suspendida).alReactivar().nombre).toBe('ACTIVA');
      // No renueva: la suspension es decision del admin, el cron no la revive.
      expect(estadoDe(suspendida).alRenovar().nombre).toBe('SUSPENDIDA');
    });
  });
});