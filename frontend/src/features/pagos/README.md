# Feature Pagos (`features/pagos`)

Módulo de Pagos (M5, RF-13 y RF-14): cobro simulado con idempotencia, comprobante en PDF, anulación de pagos y reporte de ingresos del Gerente.

## Estructura de carpetas

```text
src/features/pagos/
├── components/
│   ├── ConfirmarAnulacion.vue   # ModalFz con el aviso de que no se deshace
│   ├── FiltrosPagos.vue         # Estado, concepto y período
│   ├── FormularioPago.vue       # Medio de pago simulado
│   ├── FormularioReporte.vue    # Desde y hasta
│   ├── ResultadoPago.vue        # AvisoFz con el resultado y el comprobante
│   ├── ResumenPago.vue          # Reserva, turno y monto a pagar
│   └── TablaPagos.vue           # Lista con comprobante y anulación
├── composables/
│   ├── useAnularPago.ts         # Anula y refresca la lista
│   ├── useDescargaPdf.ts        # Blob → URL temporal → descarga → revoke
│   ├── useListaPagos.ts         # Filtros, página y total (default aprobados)
│   ├── usePagarReserva.ts       # Clave de idempotencia y traducción de 400/402/409/422
│   └── useReporteIngresos.ts    # Período, validación de ayuda y descarga
├── pages/
│   ├── PagarReservaPage.vue     # /pagos/nuevo?reservaId=
│   ├── PagosPage.vue            # /pagos (RECEPCION, GERENTE)
│   └── ReporteIngresosPage.vue  # /reportes/ingresos (GERENTE)
├── services/servicioPagos.ts    # Pagos, comprobante, anulación y reporte contra api.d.ts
├── errores.ts                   # 400/402/409 por status y `type`
├── presentacion.ts              # Estados, conceptos, medios demo y montos
├── rutas.ts
└── README.md
```

## Rutas

| Ruta | Nombre | Roles | Menú |
|---|---|---|---|
| `/pagos` | `pagos` | RECEPCION, GERENTE | "Pagos" (orden 8) |
| `/pagos/nuevo?reservaId=` | `pagar-reserva` | SOCIO, RECEPCION, GERENTE, EXTERNO | — |
| `/reportes/ingresos` | `reporte-ingresos` | GERENTE | "Reportes" (orden 9) |

## Decisiones y reglas

1. **Idempotencia:** cada intento usa un `crypto.randomUUID()` en `Idempotency-Key`. Un reintento por corte de red conserva la clave (no se sabe si cobró); después de un 402 se genera una clave nueva.
2. **409:** puede ser `idempotencia-repetida` o "reserva ya cobrada". En los dos casos se consulta `listarPagos({ reservaCanchaId })` y se muestra el pago real, no un error genérico.
3. **402:** "El pago fue rechazado"; la reserva sigue confirmada y se puede reintentar.
4. **Token de pago:** el `SelectFz` usa valores opacos (`aprobada`/`rechazada`) y el composable los traduce a `tok_aprobado_demo`/`tok_rechazado_demo`. El token nunca se muestra, guarda ni loguea.
5. **Comprobante y reporte:** son PDF autenticados, así que se bajan con `parseAs: 'blob'` y se ofrecen con una URL temporal que se libera (`useDescargaPdf`). Un enlace directo no autentica porque el access token vive en memoria.
6. **El EXTERNO paga su reserva:** `/pagos/nuevo` lo admite; la lista `/pagos` y el reporte quedan para RECEPCION/GERENTE.
6. **Errores de los PDF:** con `parseAs: 'blob'` el error también llega como Blob; `desenvolverPdf` lee el `problem+json` antes de armar el `ErrorApi`.
7. **Lista de pagos:** sin estado el contrato devuelve solo los APROBADO; rechazados y anulados se piden explícitamente. La columna "Concepto" muestra el tipo genérico (también aparecen penalidades de clase).
8. **Reporte:** intervalo cerrado (incluye desde y hasta); sin fechas es todo el histórico. El front valida `desde <= hasta` solo como ayuda de uso.
9. **Montos:** `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.

## Verificación

```bash
npm run type-check
npm run build
npm run test
```

Tests: `usePagarReserva.spec.ts` (misma clave en reintento por red, clave nueva tras 402, 409 con pago real), `useListaPagos.spec.ts` (default aprobados, filtro y rango inválido) y `useDescargaPdf.spec.ts` (descarga y `revokeObjectURL`).
