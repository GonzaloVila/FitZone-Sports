# Feature Pagos (`features/pagos`)

Módulo de Pagos (M5, RF-13 y RF-14): cobro simulado con idempotencia, comprobante en PDF, anulación de pagos y reporte de ingresos del Gerente.

## Estructura de carpetas

```text
src/features/pagos/
├── components/
│   ├── modales/
│   │   └── ModalPagarReserva.vue # Pago de una reserva de cancha: resumen, medio de pago, errores y resultado dentro del modal
│   ├── ConfirmarAnulacion.vue   # Confirmación en rojo (`ModalFz` tono peligro, ícono `advertencia`): resumen con `ListaDatosFz` y el aviso de que no se deshace
│   ├── FiltrosPagos.vue         # Una fila: ID de usuario (no en Mis pagos), Concepto, Estado, Desde, Hasta y "Limpiar" (solo con filtros activos)
│   ├── FormularioReporte.vue    # Una fila: Desde, Hasta y "Descargar PDF"
│   ├── ListaPagos.vue           # COMPARTIDO por Pagos y Mis pagos: encabezado, filtros, tabla, estados, pie con rango y paginación, descarga y anulación
│   └── TablaPagos.vue           # Lista; acciones de solo ícono: comprobante (`descargar`) y anulación (`cerrar`, rojo); `mostrarUsuario` y `puedeAnular`
├── composables/
│   ├── useAnularPago.ts         # Anula y refresca la lista
│   ├── useDescargaPdf.ts        # Blob → URL temporal → descarga → revoke
│   ├── useListaPagos.ts         # Filtros (incluido `usuarioId` en texto, con espera de 300 ms; `hayFiltrosActivos`, `limpiarFiltros`), página y total (estado inicial `TODOS`); `usuarioId` fijo opcional
│   ├── usePagarReserva.ts       # Medio elegido, clave de idempotencia y traducción de 400/402/409/422
│   └── useReporteIngresos.ts    # Período, validación de ayuda y descarga
├── pages/
│   ├── MisPagosPage.vue         # /mis-pagos (SOCIO, EXTERNO): `ListaPagos` acotada al usuario de la sesión
│   ├── PagosPage.vue            # /pagos (RECEPCION, GERENTE): `ListaPagos` completa
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
| `/mis-pagos` | `mis-pagos` | SOCIO, EXTERNO | "Mis pagos" (orden 7, sin sección: la última opción de la barra de SOCIO y EXTERNO) |
| `/pagos/nuevo?reservaId=` | `pagar-reserva` | SOCIO, EXTERNO | — Redirige a `/canchas?vista=mis-reservas&pagar=<reservaId>` (ver 10) |
| `/reportes/ingresos` | `reporte-ingresos` | GERENTE | "Reportes" (orden 9) |

## Decisiones y reglas

1. **Idempotencia:** cada intento usa un `crypto.randomUUID()` en `Idempotency-Key`. Un reintento por corte de red conserva la clave (no se sabe si cobró); después de un 402 se genera una clave nueva; al reabrir el modal (`reiniciar`) también. Además la clave va ligada a la reserva para la que se generó: pagar otra reserva con el mismo composable nunca reutiliza la clave de la anterior.
2. **409:** puede ser `idempotencia-repetida` o "reserva ya cobrada". En los dos casos se consulta `listarPagos({ reservaCanchaId })` y, si hay un pago, se muestra el pago real. Si no hay ninguno y el 409 es `idempotencia-repetida` (la clave ya estaba usada por otro cobro), no hubo cobro de esta reserva: se dice "No se pudo procesar el pago. Probá de nuevo." y el reintento usa una clave nueva. Un 409 de otro tipo sin pago sigue diciendo "Ese cobro ya fue procesado."
3. **402:** "El pago fue rechazado"; la reserva sigue confirmada y se puede reintentar sin cerrar el modal.
4. **Token de pago:** el `SelectFz` usa valores opacos (`aprobada`/`rechazada`) y el composable los traduce a `tok_aprobado_demo`/`tok_rechazado_demo`. El token nunca se muestra, guarda ni loguea. El select arranca en "Elegí un medio de pago" (opción deshabilitada, como los altas del proyecto); si se paga sin elegir, el error "Elegí un medio de pago." sale junto al campo, dentro del modal, y no se manda nada al servidor.
5. **Comprobante y reporte:** son PDF autenticados, así que se bajan con `parseAs: 'blob'` y se ofrecen con una URL temporal que se libera (`useDescargaPdf`). Un enlace directo no autentica porque el access token vive en memoria.
6. **El EXTERNO paga su reserva** igual que el SOCIO; la lista `/pagos` y el reporte quedan para RECEPCION/GERENTE; sus propios pagos los ve en `/mis-pagos`.
6. **Errores de los PDF:** con `parseAs: 'blob'` el error también llega como Blob; `desenvolverPdf` lee el `problem+json` antes de armar el `ErrorApi`.
7. **Lista de pagos:** sin `estado` el contrato devuelve solo los APROBADO (no cambia); `estado=TODOS` devuelve cualquier estado y los demás se piden explícitamente. La pantalla manda siempre el estado, y arranca en `TODOS`. La columna "Concepto" muestra el tipo genérico (también aparecen penalidades de clase).
8. **Reporte:** intervalo cerrado (incluye desde y hasta); sin fechas es todo el histórico. El front valida `desde <= hasta` solo como ayuda de uso.
9. **Montos:** `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.
10. **El pago es un modal, no una pantalla** (`ModalPagarReserva`): lo abren "Mis reservas" (acción "Pagar" del menú de cada reserva) y el aviso de reserva confirmada de la grilla de turnos ("Pagar ahora"), así que la persona no sale de la pantalla donde está. Contenido: resumen compacto (`ListaDatosFz` del kit: cancha, día, turno y el monto destacado), el select "Medio de pago" y los botones "Cancelar" y "Pagar". Los errores (402, 409, red, 422) se muestran dentro del modal, que sigue abierto para reintentar (un aviso flotante quedaría detrás del `<dialog>`). Si sale bien, el mismo modal pasa a "Pago aprobado por $X." con "Descargar comprobante" y "Cerrar"; al cerrarlo emite `pagado` y la pantalla que lo abrió se actualiza para reflejar "Pagada". No hay ninguna aclaración de que el cobro es simulado.
11. **Entre features:** `ModalPagarReserva` vive en pagos (es del dominio del cobro) y lo importa `features/canchas`, igual que `clases` ya importa `useDescargaPdf` de acá. Para no crear una dependencia circular, pagos solo importa de canchas el **tipo** `ReservaCancha` (se borra al compilar): el modal recibe la reserva y el nombre de su cancha ("Fútbol 5 #2", que arma `canchas/etiquetas.ts`) por props y no llama a nada de canchas.
12. **`/pagos/nuevo?reservaId=`:** `PagarReservaPage` se eliminó. La ruta queda como redirección (`destinoDePagoDeReserva`) a `/canchas?vista=mis-reservas&pagar=<reservaId>`; `VistaMisReservas` lee `?pagar=` (`useReservaAPagar` de canchas), trae esa reserva, abre el modal y quita el parámetro de la dirección. Sin un id válido solo se llega a "Mis reservas". Al ser una vista de quien reserva, la ruta quedó para SOCIO y EXTERNO.

13. **Foco al pagar:** al aparecer el resultado el formulario (y el botón "Pagar" que tenía el foco) desaparece, así que el foco pasa a la región del resultado (`role="group"`, `tabindex="-1"`, "Resultado del pago", sin contorno porque no es un control). Se anuncia por su nombre y por la descripción (el texto del resultado) y el aviso de adentro lleva `aria-live="off"` para no repetirse; el aviso de error de la descarga, que aparece después, sí se anuncia solo. El foco no va a un botón (un Enter de más descargaría o cerraría sin querer). No tiene test: es comportamiento de pantalla y el repo no prueba pantallas completas.

14. **Acciones de la lista (convención de las tablas):** "Comprobante" (solo APROBADO) y "Anular" (APROBADO o PENDIENTE) son botones de solo ícono (`AccionesFilaFz`, máximo 2 → íconos) en una columna con el encabezado "Acciones" visible, centrada y separada por una línea vertical (`conDivisor`); los pagos RECHAZADO y ANULADO siguen mostrando "—". En "Mis pagos" no existe "Anular": queda solo "Comprobante" (un ícono). Al anular, el foco vuelve al primer control que siga en la fila.

15. **Pasada visual (paso 9c-2):** encabezado (`EncabezadoPaginaFz` con la insignia "N pagos"), filtros en una fila con "Limpiar" y pie con "Mostrando X a Y de Z pagos" más paginación, todo como Canchas; la tabla no desaparece al recargar (queda ocupada) y "Cargando pagos…" solo sale si todavía no hay filas. La anulación es una confirmación en rojo (`ConfirmarAnulacion`, ícono `advertencia`, botones "Cancelar" y "Anular pago") y su éxito sale como aviso flotante ("Pago anulado"), no inline. El rango del pie sale de `compartido/paginacion.ts` (`textoDeRango`); las otras pantallas con el rango copiado no se migraron.

16. **Filtros y columnas de la lista (orden):** los filtros van de izquierda a derecha ID de usuario, Concepto, Estado, Desde, Hasta y "Limpiar". Las columnas son Usuario, Fecha, Concepto, Estado, Monto y Acciones (en Mis pagos, sin Usuario); Fecha, Estado y Monto son ajustadas (Monto alineado al final) y Usuario y Concepto reparten el resto. **ID de usuario** (`tipo="number"`, `min="1"`, ícono `buscar`): `useListaPagos` guarda el texto en `filtros.usuarioId` (un campo `type="number"` entrega un NÚMERO en runtime, así que el composable lo lee siempre por `comoTexto`, en un único punto) y lo manda como entero positivo después de 300 ms sin escribir (como el buscador por nombre del historial de acceso, pero también para el ID, que allá consulta en cada dígito); vacío o inválido no se manda. El `usuarioId` fijo de Mis pagos manda sobre el campo, que ahí no se muestra. **Estado:** arranca en "Todos los estados" (`value 'TODOS'`), seguido de Aprobado, Pendiente, Rechazado y Anulado (`ESTADOS_FILTRO` en `presentacion.ts`, único punto de verdad). El front manda siempre el estado explícito; `hayFiltrosActivos` solo lo cuenta si es distinto de `TODOS` y `limpiarFiltros` lo vuelve a `TODOS`. El backend mantiene que **sin `estado` devuelve solo los aprobados** (otros clientes dependen de eso); `estado=TODOS` es lo que devuelve pagos en cualquier estado.

17. **"Penalidad de clase":** un pago con concepto `RESERVA_CLASE` es siempre la penalidad por cancelación tardía (RF-07), no el pago de una clase, así que se muestra como "Penalidad de clase" en el filtro, la tabla y la confirmación de anulación. El valor interno no cambia.

18. **Mis pagos (SOCIO y EXTERNO):** `/mis-pagos` usa la misma `ListaPagos` que Pagos (mismos filtros, tabla, pie y descarga de comprobante), sin columna Usuario, sin "Anular" y sin modal ni avisos de anulación. Manda siempre `usuarioId` con el de la sesión (`useUsuarioSesion`, el mismo que usa "Mis reservas" de canchas); no se edita ni se ve, y `hayFiltrosActivos` y `limpiarFiltros` no lo cuentan ni lo tocan. Sin usuario en la sesión no consulta nada. **Mis pagos filtra por `usuarioId` desde el front; el backend hoy no valida que el pago sea del usuario**: quien arme la consulta a mano podría pedir los de otro (pendiente de backend).

## Verificación

```bash
npm run type-check
npm run build
npm run test
```

Tests: `usePagarReserva.spec.ts` (medio sin elegir, token opaco, misma clave en reintento por red, clave nueva tras 402, 409 con pago real, reiniciar), `useListaPagos.spec.ts` (estado inicial `TODOS`, filtro, rango inválido, `hayFiltrosActivos`, `limpiarFiltros` y `usuarioId` fijo), `compartido/paginacion.spec.ts` (rango y texto del pie), `useDescargaPdf.spec.ts` (descarga y `revokeObjectURL`) y `rutas.spec.ts` (roles, `/mis-pagos` y redirección de `/pagos/nuevo`).
