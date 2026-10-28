# Feature Pagos (`features/pagos`)

Módulo de Pagos (M5, RF-13 y RF-14): cobro simulado con idempotencia, comprobante en PDF, anulación de pagos y reporte de ingresos del Gerente.

## Estructura de carpetas

```text
src/features/pagos/
├── components/
│   ├── modales/
│   │   └── ModalPagarReserva.vue # Pago de una reserva de cancha: resumen, medio de pago, errores y resultado dentro del modal
│   ├── ConfirmarAnulacion.vue   # ModalFz con el aviso de que no se deshace
│   ├── FiltrosPagos.vue         # Estado, concepto y período
│   ├── FormularioReporte.vue    # Desde y hasta
│   └── TablaPagos.vue           # Lista con comprobante y anulación
├── composables/
│   ├── useAnularPago.ts         # Anula y refresca la lista
│   ├── useDescargaPdf.ts        # Blob → URL temporal → descarga → revoke
│   ├── useListaPagos.ts         # Filtros, página y total (default aprobados)
│   ├── usePagarReserva.ts       # Medio elegido, clave de idempotencia y traducción de 400/402/409/422
│   └── useReporteIngresos.ts    # Período, validación de ayuda y descarga
├── pages/
│   ├── PagosPage.vue            # /pagos (RECEPCION, GERENTE)
│   └── ReporteIngresosPage.vue  # /reportes/ingresos (GERENTE)
├── services/servicioPagos.ts    # Pagos, comprobante, anulación y reporte contra api.d.ts
├── errores.ts                   # 400/402/409 por status y `type`
├── presentacion.ts              # Estados, conceptos, medios demo, montos, día y horario
├── rutas.ts
└── README.md
```

## Rutas

| Ruta | Nombre | Roles | Menú |
|---|---|---|---|
| `/pagos` | `pagos` | RECEPCION, GERENTE | "Pagos" (orden 8) |
| `/pagos/nuevo?reservaId=` | `pagar-reserva` | SOCIO, EXTERNO | — Redirige a `/canchas?vista=mis-reservas&pagar=<reservaId>` (ver 10) |
| `/reportes/ingresos` | `reporte-ingresos` | GERENTE | "Reportes" (orden 9) |

## Decisiones y reglas

1. **Idempotencia:** cada intento usa un `crypto.randomUUID()` en `Idempotency-Key`. Un reintento por corte de red conserva la clave (no se sabe si cobró); después de un 402 se genera una clave nueva; al reabrir el modal (`reiniciar`) también. Además la clave va ligada a la reserva para la que se generó: pagar otra reserva con el mismo composable nunca reutiliza la clave de la anterior.
2. **409:** puede ser `idempotencia-repetida` o "reserva ya cobrada". En los dos casos se consulta `listarPagos({ reservaCanchaId })` y, si hay un pago, se muestra el pago real. Si no hay ninguno y el 409 es `idempotencia-repetida` (la clave ya estaba usada por otro cobro), no hubo cobro de esta reserva: se dice "No se pudo procesar el pago. Probá de nuevo." y el reintento usa una clave nueva. Un 409 de otro tipo sin pago sigue diciendo "Ese cobro ya fue procesado."
3. **402:** "El pago fue rechazado"; la reserva sigue confirmada y se puede reintentar sin cerrar el modal.
4. **Token de pago:** el `SelectFz` usa valores opacos (`aprobada`/`rechazada`) y el composable los traduce a `tok_aprobado_demo`/`tok_rechazado_demo`. El token nunca se muestra, guarda ni loguea. El select arranca en "Elegí un medio de pago" (opción deshabilitada, como los altas del proyecto); si se paga sin elegir, el error "Elegí un medio de pago." sale junto al campo, dentro del modal, y no se manda nada al servidor.
5. **Comprobante y reporte:** son PDF autenticados, así que se bajan con `parseAs: 'blob'` y se ofrecen con una URL temporal que se libera (`useDescargaPdf`). Un enlace directo no autentica porque el access token vive en memoria.
6. **El EXTERNO paga su reserva** igual que el SOCIO; la lista `/pagos` y el reporte quedan para RECEPCION/GERENTE.
6. **Errores de los PDF:** con `parseAs: 'blob'` el error también llega como Blob; `desenvolverPdf` lee el `problem+json` antes de armar el `ErrorApi`.
7. **Lista de pagos:** sin estado el contrato devuelve solo los APROBADO; rechazados y anulados se piden explícitamente. La columna "Concepto" muestra el tipo genérico (también aparecen penalidades de clase).
8. **Reporte:** intervalo cerrado (incluye desde y hasta); sin fechas es todo el histórico. El front valida `desde <= hasta` solo como ayuda de uso.
9. **Montos:** `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.
10. **El pago es un modal, no una pantalla** (`ModalPagarReserva`): lo abren "Mis reservas" (acción "Pagar" del menú de cada reserva) y el aviso de reserva confirmada de la grilla de turnos ("Pagar ahora"), así que la persona no sale de la pantalla donde está. Contenido: resumen compacto (`ListaDatosFz` del kit: cancha, día, turno y el monto destacado), el select "Medio de pago" y los botones "Cancelar" y "Pagar". Los errores (402, 409, red, 422) se muestran dentro del modal, que sigue abierto para reintentar (un aviso flotante quedaría detrás del `<dialog>`). Si sale bien, el mismo modal pasa a "Pago aprobado por $X." con "Descargar comprobante" y "Cerrar"; al cerrarlo emite `pagado` y la pantalla que lo abrió se actualiza para reflejar "Pagada". No hay ninguna aclaración de que el cobro es simulado.
11. **Entre features:** `ModalPagarReserva` vive en pagos (es del dominio del cobro) y lo importa `features/canchas`, igual que `clases` ya importa `useDescargaPdf` de acá. Para no crear una dependencia circular, pagos solo importa de canchas el **tipo** `ReservaCancha` (se borra al compilar): el modal recibe la reserva y el nombre de su cancha ("Fútbol 5 #2", que arma `canchas/etiquetas.ts`) por props y no llama a nada de canchas.
12. **`/pagos/nuevo?reservaId=`:** `PagarReservaPage` se eliminó. La ruta queda como redirección (`destinoDePagoDeReserva`) a `/canchas?vista=mis-reservas&pagar=<reservaId>`; `VistaMisReservas` lee `?pagar=` (`useReservaAPagar` de canchas), trae esa reserva, abre el modal y quita el parámetro de la dirección. Sin un id válido solo se llega a "Mis reservas". Al ser una vista de quien reserva, la ruta quedó para SOCIO y EXTERNO.

## Verificación

```bash
npm run type-check
npm run build
npm run test
```

Tests: `usePagarReserva.spec.ts` (medio sin elegir, token opaco, misma clave en reintento por red, clave nueva tras 402, 409 con pago real, reiniciar), `useListaPagos.spec.ts` (default aprobados, filtro y rango inválido), `useDescargaPdf.spec.ts` (descarga y `revokeObjectURL`) y `rutas.spec.ts` (roles y redirección de `/pagos/nuevo`).
