import { describe, expect, it } from 'vitest';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { PRECIOS_PLAN, estaVigente } from '../entities/membresia.entity';
import type { Membresia } from '../entities/membresia.entity';
import { MembresiasService } from './membresias.service';
import type { MembresiaRepository } from '../repositories/membresia.repository';
import type { SocioRepository } from '../repositories/socio.repository';

// La regla RN-03 vivia en `MembresiaValidationAdapter` y no tenia cobertura propia:
// los e2e solo la cruzaban de paso al reservar o al ingresar. Con la migracion a
// capas la regla quedo en `MembresiasService`, asi que estos tests fijan la
// combinacion de estado y fecha_fin que antes nadie verificaba.

function membresiaValida(over: Partial<Membresia> = {}): Membresia {
  return {
    id: 1,
    socio_id: 1,
    plan: 'MENSUAL',
    estado: 'ACTIVA',
    fecha_inicio: new Date('2026-09-01T12:00:00.000Z'),
    fecha_fin: new Date('2099-11-01T12:00:00.000Z'),
    precio: PRECIOS_PLAN.MENSUAL,
    renueva_automatica: true,
    updated_at: new Date('2026-09-01T12:00:00.000Z'),
    ...over,
  };
}

// Monta el service con repositorios en memoria. Es la unica razon por la que se
// puede llamar al constructor sin Nest: las consultas de vigencia son funciones
// puras sobre estas dos tablas, no dependen de la conexion.
function service(opts: { socioId?: number | null; membresia?: Membresia | null } = {}) {
  const socioId = opts.socioId === undefined ? 1 : opts.socioId;
  const membresia = opts.membresia === undefined ? membresiaValida() : opts.membresia;

  const socios = {
    buscarPorId: async (id: number) => (id === socioId ? { id } : null),
    buscarPorUsuarioId: async (usuarioId: number) => (usuarioId === socioId ? { id: socioId } : null),
  } as unknown as SocioRepository;

  const membresias = {
    buscarPorSocioId: async () => membresia,
  } as unknown as MembresiaRepository;

  const eventos = {
    emitAsync: async () => undefined,
  } as unknown as EventEmitter2;

  return new MembresiasService(membresias, socios, eventos);
}

describe('MembresiasService - consultas de vigencia', () => {
  it('da por vigente una membresia ACTIVA dentro del periodo', async () => {
    expect(await service().consultarVigencia(1)).toEqual({ vigente: true });
  });

  it('da por no vigente a quien no es socio', async () => {
    const s = service({ socioId: null });
    expect(await s.consultarVigencia(1)).toEqual({ vigente: false });
  });

  it('da por no vigente a quien no tiene membresia', async () => {
    const s = service({ membresia: null });
    expect(await s.consultarVigencia(1)).toEqual({ vigente: false });
  });

  it('da por no vigente una membresia suspendida', async () => {
    const s = service({ membresia: membresiaValida({ estado: 'SUSPENDIDA' }) });
    expect(await s.consultarVigencia(1)).toEqual({ vigente: false });
  });

  // RN-03 junto con estaVigente(): el cron diario mueve `estado` a VENCIDA, pero
  // entre la fecha_fin y la corrida siguiente el registro sigue ACTIVA. La
  // vigencia real tiene que depender de la fecha, no solo del estado.
  it('da por no vigente una membresia ACTIVA cuya fecha_fin ya paso', async () => {
    const s = service({
      membresia: membresiaValida({ estado: 'ACTIVA', fecha_fin: new Date('2020-01-01T00:00:00.000Z') }),
    });
    expect(await s.consultarVigencia(1)).toEqual({ vigente: false });
  });

  it('marca en mora a un socio sin membresia', async () => {
    const s = service({ membresia: null });
    expect(await s.consultarVigenciaPorSocio(1)).toEqual({
      esSocio: true,
      vigente: false,
      enMora: true,
    });
  });

  it('marca en mora una membresia vencida por fecha aunque el estado siga ACTIVA', async () => {
    const s = service({
      membresia: membresiaValida({ estado: 'ACTIVA', fecha_fin: new Date('2020-01-01T00:00:00.000Z') }),
    });
    expect(await s.consultarVigenciaPorSocio(1)).toEqual({
      esSocio: true,
      vigente: false,
      enMora: true,
    });
  });

  it('distingue socio inexistente de socio en mora', async () => {
    const s = service({ socioId: null });
    expect(await s.consultarVigenciaPorSocio(1)).toEqual({
      esSocio: false,
      vigente: false,
      enMora: false,
    });
  });

  it('no marca en mora a la membresia al dia', async () => {
    expect(await service().consultarVigenciaPorSocio(1)).toEqual({
      esSocio: true,
      vigente: true,
      enMora: false,
    });
  });

  it('estaVigente acepta una membresia que termina exactamente ahora', () => {
    const ahora = new Date('2026-10-01T12:00:00.000Z');
    expect(estaVigente(membresiaValida({ fecha_fin: ahora }), ahora)).toBe(true);
  });
});
