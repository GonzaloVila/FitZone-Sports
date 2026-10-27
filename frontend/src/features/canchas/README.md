# Feature Canchas (`features/canchas`)

Módulo de Canchas (M4, RF-09 a RF-12): lista de canchas de todas las sedes (con alta y edición para el GERENTE), pantalla de turnos por día, reserva con precio dinámico, cancelación y mantenimiento. "Mis reservas" es una vista de la pantalla de Canchas.

## Estructura de carpetas

```text
src/features/canchas/
├── components/
│   ├── modales/
│   │   ├── ModalEditarCancha.vue    # Edición (GERENTE): costo por hora y estado, errores internos y aviso de éxito
│   │   └── ModalNuevaCancha.vue     # Alta de cancha: encabezado, pie, errores internos y aviso de éxito
│   ├── CabeceraCancha.vue           # Datos de la cancha en la pantalla de turnos: deporte, sede, precio base y estado
│   ├── ConfirmarReserva.vue         # Modal de confirmación de la reserva, con el error adentro
│   ├── FiltrosCanchas.vue           # Una fila: deporte, sede y estado a la izquierda; "Nueva cancha" (GERENTE) a la derecha
│   ├── FormularioCancha.vue         # Solo los campos de CanchaIn (el modal pone el resto)
│   ├── GrillaTurnos.vue             # Turnos del día agrupados en Mañana / Tarde / Noche, con el resumen "N libres · M ocupados"
│   ├── ListaCanchas.vue             # Tabla: deporte, (sede), estado, precio base y acciones (menú "···" para el GERENTE; "Ver turnos" directo para los demás)
│   ├── ModalCancelarReserva.vue     # Confirmación de la cancelación, con el error adentro
│   ├── TablaReservas.vue            # Reservas propias con cancelar y pagar
│   ├── TiraDeDias.vue               # Los próximos siete días (Hoy, Mañana, …) como botones
│   ├── TurnoDeCancha.vue            # Un turno: botón para quien reserva, información para el personal
│   └── VistaMisReservas.vue         # Vista "Mis reservas": pestañas, cancelación y pago
├── composables/
│   ├── useAltaCancha.ts             # Validación de ayuda de uso y errores del alta (sede y deporte sin precargar)
│   ├── useCanchas.ts                # Lista (GET /canchas): filtros y página en la dirección, descarte de respuestas viejas
│   ├── useEditarCancha.ts           # Edición: valida, manda solo lo que cambió y deja los errores para el modal
│   ├── useFechaDeTurnos.ts          # El día de los turnos (?fecha=) y la tira de siete días
│   ├── useGrillaTurnos.ts           # Cancha + disponibilidad del día
│   ├── useMisReservas.ts            # Reservas del usuario de la sesión por estado
│   ├── useReservarTurno.ts          # Crea la reserva y traduce el 409
│   └── useVistaCanchas.ts           # Vista activa (Canchas / Mis reservas) en la dirección
├── pages/
│   ├── GrillaTurnosPage.vue         # /canchas/:canchaId/turnos
│   └── ListaCanchasPage.vue         # /canchas (con el selector Canchas / Mis reservas para SOCIO y EXTERNO)
├── services/servicioCanchas.ts      # Canchas, disponibilidad y reservas contra api.d.ts
├── direccion.ts                     # Filtros, página y origen de la grilla ↔ parámetros de la dirección (lógica pura)
├── edicion.ts                       # Validación, cambios y mensajes de éxito de la edición (lógica pura)
├── errores.ts                       # 409 por el campo `type` del problem+json; 422 como texto humano
├── presentacion.ts                  # Etiquetas, montos y fechas en hora de la sede
├── reglas.ts                        # `puedeReservar(rol)`: SOCIO y EXTERNO
├── rutas.ts
├── tipos.ts
├── turnos.ts                        # Días de la tira, fecha en la dirección, franjas y resumen (lógica pura)
└── README.md
```

## Rutas

| Ruta | Nombre | Roles | Menú |
|---|---|---|---|
| `/canchas` | `canchas` | SOCIO, RECEPCION, GERENTE, EXTERNO | "Canchas" (orden 6), activo en las dos vistas y en la pantalla de turnos. Filtros en la dirección: `?tipo=` (deporte), `?sede=` (id o `todas`), `?estado=` y `?pagina=` |
| `/canchas?vista=mis-reservas` | `canchas` | SOCIO, EXTERNO | — (es la misma pantalla) |
| `/canchas/:canchaId/turnos` | `cancha-turnos` | SOCIO, RECEPCION, GERENTE, EXTERNO | — `?fecha=` (uno de los próximos siete días) y `?desde=canchas` (con los filtros) o `?desde=mis-reservas` para armar el "volver" |
| `/canchas/gestion` | — | — | Redirige a `/canchas` (enlaces viejos) |
| `/mis-reservas` | `mis-reservas` | SOCIO, EXTERNO | Redirige a `/canchas?vista=mis-reservas` (enlaces viejos) |

## Decisiones y reglas

1. **Arquitectura:** página → composable → servicio → cliente tipado. Las páginas solo componen; el servicio se pide con `useServicios().canchas`.
2. **`usuarioId` de la sesión:** `LoginOut` incorporó `usuarioId` y `useUsuarioSesion` lo expone. Se usa para crear la reserva y para filtrar "mis reservas".
3. **Quién reserva:** el SOCIO y el EXTERNO (RF-01); el EXTERNO no tiene `socioId`, pero sí `usuarioId`, y el servidor lo cotiza como externo. La regla vive en `reglas.ts` (`puedeReservar`) y la usan el selector de vista y la pantalla de turnos. RECEPCION y GERENTE ven los turnos como información: sin botones, sin modal y sin el aviso "Pagar ahora". Reservar en nombre de un socio desde Recepción queda pendiente (M4).
4. **El precio lo calcula el servidor.** `DisponibilidadEntrada` no trae precio, así que ni los turnos ni su nombre accesible lo muestran: la cabecera y el modal muestran el `costoPorHora` como precio base y el `precioAplicado` del 201 es el definitivo.
5. **409 por el campo `type`:** `turno-ocupado` avisa "Ese turno acaba de ser tomado, elegí otro" y recarga los turnos; `cancha-en-mantenimiento` tiene su propio mensaje; al cancelar, `reserva-ya-cancelada` y `reserva-pasada` se distinguen por `type`.
6. **422 sin texto crudo:** el servidor devuelve la validación en inglés ("costoPorHora must be …"). No se muestra: se dice que se revise lo cargado (reserva, cancelación y alta o edición de una cancha), sin inventar la causa.
7. **Errores dentro del modal:** un aviso flotante queda detrás del `<dialog>`, así que el error de la reserva, de la cancelación, del alta y de la edición de una cancha se muestra dentro del modal, que sigue abierto. Solo se cierra si salió bien. Con el modal cerrado, el error de la reserva se ve en la página.
8. **Mantenimiento (A):** pasar una cancha a `EN_MANTENIMIENTO` **no toca las reservas existentes**. Los turnos se superponen con las reservas del día (`CONFIRMADA` + `CUMPLIDA`): esos tramos se muestran como "Ocupado" y el resto como "En mantenimiento". El servidor igual responde 409 a cualquier reserva nueva.
9. **"Mis reservas" dentro de "Canchas":** quien reserva ve debajo del encabezado un selector Canchas / Mis reservas (`SelectorSegmentadoFz`). La vista vive en la dirección (`?vista=mis-reservas`; sin query, las canchas; `useVistaCanchas`), así que Atrás, favoritos y recargar la conservan. `VistaMisReservas` solo se monta mientras está activa. RECEPCION y GERENTE no ven el selector y un `?vista=` en su dirección se ignora. Pestañas Próximas, Canceladas (`estado=CANCELADA`) y Pasadas (`estado=CUMPLIDA`); las pestañas no se desmontan al cambiar (el foco queda en ellas) y la carga se muestra dentro del panel. La situación se deriva en el front (Próxima / En curso / Cumplida / Cancelada). "Pagar" aparece en `CONFIRMADA` y `CUMPLIDA` impagas; "Cancelar" solo si el turno **todavía no empezó** (`puedeCancelarse`).
10. **Cancelar no cobra nada:** `POST /reservas-canchas/{id}/cancelaciones` responde 204 y el contrato no menciona penalidad para canchas, así que no se usa `usePenalidadCobrada` (es solo de las clases).
11. **Turnos pasados:** la disponibilidad marca `inicio <= ahora` como no disponible y `POST /reservas-canchas` responde **422** `Turno pasado`. Los turnos muestran esos tramos como "Ya pasó".
12. **Limitaciones del contrato:** `ReservaCanchaOut` no trae la cancha (se muestra "Cancha #id") y `DisponibilidadEntrada` no trae precio.
13. **Fechas:** el `fecha` de la consulta es `YYYY-MM-DD` y las horas se formatean en `America/Argentina/Buenos_Aires`. Un reloj local de 30 s y un refresco de 60 s mantienen la situación al día.
14. **Sede en la lista (`GET /canchas`):** el servidor filtra (`sedeId`, `tipo`, `estado`) y pagina; nada se junta del lado del cliente. El filtro de sede arranca en "Todas las sedes" para el GERENTE, el SOCIO y el EXTERNO, y con "todas" la tabla suma la columna Sede. El RECEPCION con sede en el token ve siempre la suya y no tiene selector (un `?sede=` de la dirección no la cambia); si no tiene sede en el token, arranca en la sede activa (`useSedeActiva`) y puede cambiarla. Un `sedeId` inexistente da una lista vacía, no un 404.
15. **Filtros y página en la dirección** (`direccion.ts`, `useCanchas`): `?tipo=` (el deporte: un único valor, validado contra `TIPOS_CANCHA`), `?sede=` (id, o `todas` si se eligió a propósito), `?estado=` (`OPERATIVA` o `EN_MANTENIMIENTO`) y `?pagina=` (desde la 2). Un parámetro ausente es el valor por defecto; uno inválido o desconocido se ignora como si no estuviera. Los cambios reemplazan la entrada del historial (`router.replace`) y cambiar un filtro vuelve a la página 1. `hayFiltrosActivos` y `limpiarFiltros` (deporte, estado y sede elegida; no cuentan la sede fija del RECEPCION ni la sede por defecto) están en el composable; la barra no tiene botón "Limpiar" todavía. Los parámetros de otra ruta (la pantalla de turnos) no se leen como filtros.
15b. **Deporte:** es un selector ("Todos los deportes" + una opción por cada valor de `TIPOS_CANCHA`) y manda un único `tipo` a `GET /canchas`. La lista de deportes y sus nombres salen de un solo lugar, `ETIQUETA_TIPO_CANCHA` en `presentacion.ts` (un `Record<TipoCancha, string>`: sumar un deporte al contrato rompe el type-check hasta que se le escribe el nombre), y de ahí la usan el selector del alta, el filtro, la tabla y los nombres accesibles.
15c. **Disposición:** el encabezado (título, contador y subtítulo) queda solo arriba. Debajo hay una única fila de herramientas: el selector de deporte (los tres selects miden lo que su contenido), el de sede (no está para el RECEPCION con sede en el token) y el de estado a la izquierda, y "Nueva cancha" (solo GERENTE) pegado al borde derecho, a la misma altura. En ancho chico la fila se apila sin cambiar el orden. Las columnas son Deporte, Sede (solo con "Todas las sedes"), Estado, Precio base por hora y Acciones.
15d. **Acciones por fila:** el GERENTE tiene dos (Ver turnos y Editar), en el menú de tres puntos del kit (`MenuAccionesFz`, el mismo de la tabla de Socios; botón "Acciones de <deporte> #<id>", se abre y se recorre con el teclado, Esc cierra y el foco vuelve al botón). Al cerrarse el modal de edición el foco vuelve al botón de esa fila, porque el ítem que lo abrió ya no existe. Los demás roles tienen una sola acción: "Ver turnos" va directo, sin menú. "Ver turnos" lleva el ícono `reloj` (en el menú y en el botón directo); el ícono `canchas` (una cancha vista desde arriba) queda para el menú lateral y para la confirmación de la reserva.
16. **"Volver" de los turnos** (`destinoVolver`): los enlaces a los turnos llevan `?desde=canchas` (más los filtros de la lista) o `?desde=mis-reservas`. El "volver" se arma solo con la dirección, sin el historial del navegador: "Volver a canchas" (con sus filtros) o "Volver a mis reservas". `desde` se valida contra la lista cerrada; otro valor, o `mis-reservas` en quien no reserva, es entrada directa y vuelve a la lista sin filtros. `?fecha=` no se arrastra al volver.
17. **Alta y edición en modales** (solo GERENTE, desde `/canchas`): "Nueva cancha" (en la fila de herramientas) arranca con la sede y el deporte sin elegir (criterio de los selects obligatorios de un alta: primera opción "Elegí una sede" / "Elegí un deporte" y error "Elegí …" junto al campo). "Editar" (en el menú de cada fila) cambia el costo por hora y el estado; manda solo lo que cambió y, si no cambió nada, lo dice dentro del modal. El aviso de éxito dice qué cambió ("El costo por hora pasó de … a …", "La cancha pasó a mantenimiento."). Los dos recargan la lista al guardar.
18. **Costo por hora como número:** un campo `type="number"` entrega un número en runtime aunque el modelo se declare como texto, así que el costo se pasa a texto con `comoTexto` (`compartido/`) antes de validarlo.
19. **Pantalla de turnos** (`/canchas/:canchaId/turnos`): cabecera con los datos de la cancha, tira de los próximos siete días (Hoy, Mañana y los siguientes; el elegido va en `?fecha=`, hoy no se escribe y una fecha inválida o fuera de la tira vale hoy), turnos agrupados en Mañana (hasta las 12), Tarde (hasta las 19) y Noche, y un resumen "N libres · M ocupados". Cada turno dice su estado con texto y con un ícono (Libre, Ocupado, En mantenimiento, Ya pasó), no solo con el color, y su nombre accesible dice la hora y el estado. Para quien reserva cada turno es un botón (los que no se pueden reservar son `aria-disabled`, para que se lleguen con Tab y se escuchen); para RECEPCION y GERENTE son información.
20. **Accesibilidad:** foco visible; los enlaces con aspecto de botón son `<a>` (no hay botones dentro de enlaces); la tira de días usa `aria-pressed` y nombres completos ("jueves 12 de noviembre"); estados de carga y vacíos con `role="status"`.

## Verificación

```bash
npm run type-check
npm run build
npm run test
```

Los tests de composables y de lógica pura viven al lado del código (`*.spec.ts`): `useCanchas`, `useEditarCancha`, `useAltaCancha`, `useFechaDeTurnos`, `useVistaCanchas`, `useReservarTurno`, `servicioCanchas`, `direccion`, `edicion`, `turnos`, `reglas`, `errores`, `presentacion` y `rutas`.
