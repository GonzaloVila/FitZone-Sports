# Feature Canchas (`features/canchas`)

Módulo de Canchas (M4, RF-09 a RF-12): gestión de canchas por sede, grilla de turnos, reserva con precio dinámico, cancelación y mantenimiento. "Mis reservas" es una vista de la pantalla de Canchas.

## Estructura de carpetas

```text
src/features/canchas/
├── components/
│   ├── modales/
│   │   └── ModalNuevaCancha.vue     # Alta de cancha: encabezado, pie, errores internos y aviso de éxito
│   ├── ConfirmarReserva.vue         # Modal de confirmación de la reserva, con el error adentro
│   ├── FiltrosCanchas.vue           # Filtros en fila: sede y estado
│   ├── FormularioCancha.vue         # Solo los campos de CanchaIn (el modal pone el resto)
│   ├── GrillaTurnos.vue             # Turnos del día en tabla: horario, estado en palabras y "Reservar" (solo quien reserva)
│   ├── ListaCanchas.vue             # Tabla con deporte, estado, precio base y enlace a los turnos
│   ├── ModalCancelarReserva.vue     # Confirmación de la cancelación, con el error adentro
│   ├── TablaGestionCanchas.vue      # Costo por hora y mantenimiento (GERENTE)
│   ├── TablaReservas.vue            # Reservas propias con cancelar y pagar
│   └── VistaMisReservas.vue         # Vista "Mis reservas": pestañas, cancelación y pago
├── composables/
│   ├── useAltaCancha.ts             # Validación de ayuda de uso, sede inicial y errores del alta
│   ├── useCanchas.ts                # Lista de la sede: filtros y página en la dirección, descarte de respuestas viejas
│   ├── useGestionCanchas.ts         # Canchas de la sede activa, costo por hora y mantenimiento (GERENTE)
│   ├── useGrillaTurnos.ts           # Cancha + disponibilidad del día
│   ├── useMisReservas.ts            # Reservas del usuario de la sesión por estado
│   ├── useReservarTurno.ts          # Crea la reserva y traduce el 409
│   └── useVistaCanchas.ts           # Vista activa (Canchas / Mis reservas) en la dirección
├── pages/
│   ├── GestionCanchasPage.vue       # /canchas/gestion (GERENTE)
│   ├── GrillaTurnosPage.vue         # /canchas/:canchaId/turnos
│   └── ListaCanchasPage.vue         # /canchas (con el selector Canchas / Mis reservas para SOCIO y EXTERNO)
├── services/servicioCanchas.ts      # Canchas, disponibilidad y reservas contra api.d.ts
├── direccion.ts                     # Filtros, página y origen de la grilla ↔ parámetros de la dirección (lógica pura)
├── errores.ts                       # 409 por el campo `type` del problem+json; 422 como texto humano
├── presentacion.ts                  # Etiquetas, montos y fechas en hora de la sede
├── reglas.ts                        # `puedeReservar(rol)`: SOCIO y EXTERNO
├── rutas.ts
├── tipos.ts
└── README.md
```

## Rutas

| Ruta | Nombre | Roles | Menú |
|---|---|---|---|
| `/canchas` | `canchas` | SOCIO, RECEPCION, GERENTE, EXTERNO | "Canchas" (orden 6), activo en las dos vistas y en la grilla y la gestión. Filtros en la dirección: `?sede=`, `?estado=` y `?pagina=` |
| `/canchas?vista=mis-reservas` | `canchas` | SOCIO, EXTERNO | — (es la misma pantalla) |
| `/canchas/:canchaId/turnos` | `cancha-turnos` | SOCIO, RECEPCION, GERENTE, EXTERNO | — `?desde=canchas` (con los filtros) o `?desde=mis-reservas` arma el "volver" |
| `/canchas/gestion` | `canchas-gestion` | GERENTE | — |
| `/mis-reservas` | `mis-reservas` | SOCIO, EXTERNO | Redirige a `/canchas?vista=mis-reservas` (enlaces viejos) |

## Decisiones y reglas

1. **Arquitectura:** página → composable → servicio → cliente tipado. Las páginas solo componen; el servicio se pide con `useServicios().canchas`.
2. **`usuarioId` de la sesión:** `LoginOut` incorporó `usuarioId` y `useUsuarioSesion` lo expone. Se usa para crear la reserva y para filtrar "mis reservas".
3. **Quién reserva:** el SOCIO y el EXTERNO (RF-01); el EXTERNO no tiene `socioId`, pero sí `usuarioId`, y el servidor lo cotiza como externo. La regla vive en `reglas.ts` (`puedeReservar`) y la usan el selector de vista y la grilla. RECEPCION y GERENTE ven la grilla en modo consulta: sin botón "Reservar", sin modal y sin el aviso "Pagar ahora". Reservar en nombre de un socio desde Recepción queda pendiente (M4).
4. **El precio lo calcula el servidor.** `DisponibilidadEntrada` no trae precio, así que el modal muestra el `costoPorHora` como precio base y el `precioAplicado` del 201 es el definitivo.
5. **409 por el campo `type`:** `turno-ocupado` avisa "Ese turno acaba de ser tomado, elegí otro" y recarga la grilla; `cancha-en-mantenimiento` tiene su propio mensaje; al cancelar, `reserva-ya-cancelada` y `reserva-pasada` se distinguen por `type`.
6. **422 sin texto crudo:** el servidor devuelve la validación en inglés ("costoPorHora must be …"). No se muestra: se dice que se revise lo cargado (reserva, cancelación y alta o cambio de una cancha), sin inventar la causa.
7. **Errores dentro del modal:** un aviso flotante queda detrás del `<dialog>`, así que el error de la reserva, de la cancelación y del alta de una cancha se muestra dentro del modal, que sigue abierto. Solo se cierra si salió bien. Con el modal cerrado, el error de la reserva se ve en la página.
8. **Mantenimiento (A):** pasar una cancha a `EN_MANTENIMIENTO` **no toca las reservas existentes**. La grilla se superpone con las reservas del día (`CONFIRMADA` + `CUMPLIDA`): esos tramos se muestran como "Ocupado" y el resto como "En mantenimiento". El servidor igual responde 409 a cualquier reserva nueva.
9. **"Mis reservas" dentro de "Canchas":** quien reserva ve debajo del encabezado un selector Canchas / Mis reservas (`SelectorSegmentadoFz`). La vista vive en la dirección (`?vista=mis-reservas`; sin query, las canchas; `useVistaCanchas`), así que Atrás, favoritos y recargar la conservan. `VistaMisReservas` solo se monta mientras está activa. RECEPCION y GERENTE no ven el selector y un `?vista=` en su dirección se ignora. Pestañas Próximas, Canceladas (`estado=CANCELADA`) y Pasadas (`estado=CUMPLIDA`); las pestañas no se desmontan al cambiar (el foco queda en ellas) y la carga se muestra dentro del panel. La situación se deriva en el front (Próxima / En curso / Cumplida / Cancelada). "Pagar" aparece en `CONFIRMADA` y `CUMPLIDA` impagas; "Cancelar" solo si el turno **todavía no empezó** (`puedeCancelarse`).
10. **Cancelar no cobra nada:** `POST /reservas-canchas/{id}/cancelaciones` responde 204 y el contrato no menciona penalidad para canchas, así que no se usa `usePenalidadCobrada` (es solo de las clases).
11. **Turnos pasados:** la disponibilidad marca `inicio <= ahora` como no disponible y `POST /reservas-canchas` responde **422** `Turno pasado`. La grilla muestra esos tramos como "Ya pasó" y el selector de día arranca en hoy.
12. **Limitaciones del contrato:** `ReservaCanchaOut` no trae la cancha (se muestra "Cancha #id") y `DisponibilidadEntrada` no trae precio.
13. **Fechas:** el `fecha` de la consulta es `YYYY-MM-DD` y las horas se formatean en `America/Argentina/Buenos_Aires`. Un reloj local de 30 s y un refresco de 60 s mantienen la situación al día.
14. **Sede activa:** la comparte `compartido/composables/useSedeActiva`. Si la dirección no trae `sede`, la lista arranca en la sede activa (el RECEPCION, la suya; los demás, la elegida o la primera). El filtro de sede no tiene "todas" (las canchas se piden siempre de una sede) y elegirla ahí no cambia la sede activa. La gestión (GERENTE) sí trabaja sobre la sede activa: cambiarla ahí la cambia para las demás pantallas.
15. **Filtros y página en la dirección** (`direccion.ts`, `useCanchas`): `?sede=` (id), `?estado=` (`OPERATIVA` o `EN_MANTENIMIENTO`) y `?pagina=` (desde la 2). Un parámetro ausente es el valor por defecto; uno inválido se ignora como si no estuviera. Los cambios reemplazan la entrada del historial (`router.replace`) y cambiar un filtro vuelve a la página 1. Los parámetros de otra ruta (la grilla) no se leen como filtros.
16. **"Volver" de la grilla** (`destinoVolver`): los enlaces a la grilla llevan `?desde=canchas` (más los filtros de la lista) o `?desde=mis-reservas`. El "volver" se arma solo con la dirección, sin el historial del navegador: "Volver a canchas" (con sus filtros) o "Volver a mis reservas". `desde` se valida contra la lista cerrada; otro valor, o `mis-reservas` en quien no reserva, es entrada directa y vuelve a la lista sin filtros.
17. **Nueva cancha en un modal:** se abre desde la gestión (GERENTE), arranca con la sede activa y deja elegir la sede. Al crearla se cierra, avisa "Cancha creada" y recarga (o pasa a mirar la sede de la cancha nueva, si es otra).
18. **Accesibilidad:** la grilla es una tabla: cada turno dice su estado con una palabra (Libre, Ocupado, En mantenimiento, Ya pasó) además de la insignia de color; "Reservar" es un botón en la tabla (se llega con Tab) con nombre accesible por turno; foco visible; los enlaces con aspecto de botón son `<a>` (no hay botones dentro de enlaces); estados de carga y vacíos con `role="status"`.

## Verificación

```bash
npm run type-check
npm run build
npm run test
```

Los tests de composables y de lógica pura viven al lado del código (`*.spec.ts`): `useCanchas`, `useGestionCanchas`, `useAltaCancha`, `useVistaCanchas`, `useReservarTurno`, `direccion`, `reglas`, `errores`, `presentacion` y `rutas`.
