import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListarPagosQueryDto } from 'src/modules/m5-pagos/dtos/listar-pagos-query.dto';

/**
 * La lista blanca de `GET /pagos` vive en el DTO, y `whitelist: true` +
 * `forbidNonWhitelisted: true` es lo que hace que sea una lista blanca y no una
 * sugerencia: un `?cualquiera=` que nadie declaró tiene que ser 422, no un filtro
 * ignorado en silencio. Estos tests fijan las dos mitades: lo que entra, y lo que no.
 *
 * `forbidNonWhitelisted` es el que hace el trabajo. Sin él, `whitelist` alcanza para
 * que el service nunca vea la propiedad, y un typo en el nombre de un filtro real
 * (`?usuarioid=3`) sería un 200 con la lista completa en vez de un error.
 */
describe('ListarPagosQueryDto', () => {
  async function errores(query: Record<string, unknown>): Promise<string[]> {
    const instancia = plainToInstance(ListarPagosQueryDto, query);
    const resultado = await validate(instancia, { whitelist: true, forbidNonWhitelisted: true });

    function aplanar(errores: ValidationError[]): string[] {
      return errores.flatMap((e) => [
        ...Object.values(e.constraints ?? {}),
        ...aplanar(e.children ?? []),
      ]);
    }

    return aplanar(resultado);
  }

  it('acepta una consulta vacía: el listado sin filtros tiene que andar', async () => {
    expect(await errores({})).toEqual([]);
  });

  it('acepta los siete filtros juntos', async () => {
    expect(
      await errores({
        usuarioId: '3',
        estado: 'APROBADO',
        tipo: 'RESERVA_CANCHA',
        reservaCanchaId: '7',
        membresiaId: '3',
        desde: '2026-03-01',
        hasta: '2026-03-31',
        page: '2',
        perPage: '5',
      }),
    ).toEqual([]);
  });

  // Todo llega como string: el DTO tiene que convertir, no solo validar. Sin
  // `@Type(() => Number)` un `?usuario_id=3` que llega como '3' pasa el `@IsInt()`
  // (porque '3' no es un int, da error) pero, peor, un id arrive con `'3 '` o sin
  // convertir compararía distinto en Prisma y traería cero filas sin avisar.
  it('convierte los ids y la paginación a número', async () => {
    const d = plainToInstance(ListarPagosQueryDto, {
      usuarioId: '3',
      reservaCanchaId: '7',
      membresiaId: '3',
      page: '2',
      perPage: '5',
    });

    expect(d.usuarioId).toBe(3);
    expect(d.reservaCanchaId).toBe(7);
    expect(d.membresiaId).toBe(3);
    expect(d.page).toBe(2);
    expect(d.perPage).toBe(5);
  });

  it('deja en undefined los filtros que no vinieron, para que el service distinga ausente de vacío', async () => {
    const d = plainToInstance(ListarPagosQueryDto, {});

    // Un filtro en `undefined` es "no filtrar" y un filtro en '' sería "filtrar por
    // nada". Por eso los opcionales de filtro NO llevan default; la paginación, en
    // cambio, sí lo lleva (1/20) igual que en el listado de reservas de M4.
    expect(d.estado).toBeUndefined();
    expect(d.tipo).toBeUndefined();
    expect(d.usuarioId).toBeUndefined();
    expect(d.desde).toBeUndefined();
    expect(d.hasta).toBeUndefined();
    expect(d.page).toBe(1);
    expect(d.perPage).toBe(20);
  });

  it('un ?page=2 explícito pisa el default', async () => {
    expect(plainToInstance(ListarPagosQueryDto, { page: '2' }).page).toBe(2);
  });

  // El contrato pone mínimo 1 en page y perPage, y tope 100 en perPage. Sin el tope,
  // `?per_page=100000` es un DoS con forma de paginación.
  it('rechaza page=0 y page negativa', async () => {
    expect(await errores({ page: '0' })).not.toEqual([]);
    expect(await errores({ page: '-1' })).not.toEqual([]);
  });

  it('rechaza per_page=0 y per_page=101', async () => {
    expect(await errores({ perPage: '0' })).not.toEqual([]);
    expect(await errores({ perPage: '101' })).not.toEqual([]);
  });

  it('rechaza un id no numérico', async () => {
    expect(await errores({ usuarioId: 'tres' })).not.toEqual([]);
  });

  it('rechaza un estado fuera del enum', async () => {
    expect(await errores({ estado: 'COBRADO' })).not.toEqual([]);
  });

  it('rechaza un tipo fuera del enum', async () => {
    expect(await errores({ tipo: 'ALQUILER' })).not.toEqual([]);
  });

  // El `Matches` de YYYY-MM-DD no alcanza para detectar un día imposible: '2026-02-30'
  // tiene la forma correcta y no es una fecha. `@IsISO8601({ strict: true })` es lo que
  // lo rechaza, y sin él `rangoDelDia()` armaría un rango imposible en
  // silencio y el listado saldría vacío sin decir por qué.
  it('rechaza fechas que tienen la forma correcta pero no existen', async () => {
    expect(await errores({ desde: '2026-02-30' })).not.toEqual([]);
  });

  it('rechaza fechas que no son YYYY-MM-DD', async () => {
    expect(await errores({ desde: '2026-3-1' })).not.toEqual([]);
    expect(await errores({ hasta: '01-03-2026' })).not.toEqual([]);
    expect(await errores({ desde: 'ayer' })).not.toEqual([]);
  });

  it('rechaza un parámetro que no está en la lista blanca', async () => {
    expect(await errores({ orden: 'cualquiera' })).not.toEqual([]);
  });
});