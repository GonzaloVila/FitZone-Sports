# Feature Clases (`features/clases`)

Módulo de Clases grupales (M3): agenda (RF-06), reserva y cancelación (RF-07) y lista de espera (RF-08).

## Estructura de carpetas

```text
src/features/clases/
├── components/
│   ├── modales/
│   │   └── ModalNuevaClase.vue  # Alta de clase: encabezado, pie, errores internos y aviso de éxito
│   ├── AccionesClase.vue        # Decide el botón (reservar, cancelar, anotarse, confirmar) o el motivo
│   ├── AvisoPenalidad.vue       # Última penalidad cobrada: texto según la pantalla, "Descargar comprobante" y cierre (X)
│   ├── DatosClase.vue           # Instructor, sede, cupos y reservas en filas "etiqueta … valor"
│   ├── FilaDatoClase.vue        # Una fila de DatosClase
│   ├── FiltrosClases.vue        # Filtros en fila: disciplina y sede
│   ├── FormularioClase.vue      # Solo los campos de ClaseIn (el modal pone el resto)
│   ├── ListaEsperaClase.vue     # Cola de espera (RECEPCION / GERENTE)
│   ├── ListaInscriptos.vue      # Ocupación de la clase (RECEPCION / GERENTE)
│   ├── MarcaDeClase.vue         # Chip "Reservada" / "En espera" junto al nombre de la clase (agenda del SOCIO)
│   ├── ModalCancelarClase.vue   # Confirmación con aviso de penalidad (usa ModalFz)
│   ├── TablaClases.vue          # Agenda con cupos libres y estado
│   ├── TablaMisEsperas.vue      # Esperas del socio con posición y acciones
│   ├── TablaMisReservas.vue     # Reservas del socio (próximas / pasadas)
│   └── VistaMisClases.vue       # Vista "Mis clases" del socio: esperas, reservas y cancelación
├── composables/
│   ├── useAgendaClases.ts       # Filtros y página en la dirección, sede por defecto, descarte de respuestas viejas
│   ├── useAltaClase.ts          # Validación de ayuda de uso (incluida la fecha pasada), sede por defecto y 409 de horario
│   ├── useAvisoPenalidad.ts     # Registro de la penalidad (con su clase) tras cancelar y descarga de su comprobante
│   ├── useDetalleClase.ts       # Clase, reserva y espera vigentes del socio, acciones, actualización periódica
│   ├── useMarcasClases.ts       # Reservas y esperas vigentes del socio, para marcar su agenda (dos consultas extra)
│   ├── useMisClases.ts          # Reservas y esperas del socio logueado, actualización periódica
│   └── useVistaClases.ts        # Vista activa (Agenda / Mis clases) en la dirección
├── pages/
│   ├── AgendaClasesPage.vue     # /clases (con el selector Agenda / Mis clases para el SOCIO)
│   └── DetalleClasePage.vue     # /clases/:claseId
├── services/
│   └── servicioClases.ts        # Clases, reservas de clase y esperas contra api.d.ts
├── direccion.ts                 # Filtros, página y origen del detalle ↔ parámetros de la dirección (lógica pura)
├── errores.ts                   # Traducción de errores por el campo `type` del problem+json
├── marcasClases.ts              # Marca de cada clase de la agenda según lo que el socio tiene vigente (lógica pura)
├── presentacion.ts              # Etiquetas, variantes, estado de la clase y formato de fechas
├── reglas.ts                    # Ventana de 48 hs, penalidad (2 hs, 50%), fecha pasada y reservas/esperas vigentes
├── rutas.ts
├── textosPenalidad.ts           # Textos de la penalidad: advertencia del modal y aviso posterior según la pantalla
└── tipos.ts
```

## Rutas

| Ruta | Nombre | Roles | Menú |
|---|---|---|---|
| `/clases` | `clases` | SOCIO, RECEPCION, GERENTE | "Clases" (orden 4), activo en las dos vistas. Filtros en la dirección: `?tipo=`, `?sede=` (id o `todas`) y `?pagina=` |
| `/clases?vista=mis-clases` | `clases` | SOCIO | — (es la misma pantalla) |
| `/clases/:claseId` | `clase-detalle` | SOCIO, RECEPCION, GERENTE | — (queda activo "Clases"). `?desde=agenda` (con los filtros) o `?desde=mis-clases` arma el "volver" |
| `/mis-clases` | — | — | Redirige a `/clases?vista=mis-clases` (enlaces viejos) |

## Decisiones y reglas

1. **Arquitectura:** página → composable → servicio → cliente tipado. Las páginas solo componen. El servicio se pide con `useServicios().clases`.
2. **El servidor decide.** Las reglas de `reglas.ts` solo anticipan el motivo en pantalla (ventana de 48 hs, clase comenzada, penalidad). Si el servidor responde 409 se muestra el mismo motivo.
3. **Errores por `type`:** `errores.ts` distingue los 409 (`reserva-anticipada-no-permitida`, `clase-pasada`, `cupo-agotado`, `reserva-duplicada`, `cupo-disponible`, `espera-existente`, `espera-confirmada`, `espera-no-notificada`, `cupo-tomado`). 403 es cuota vencida y 402 es penalidad rechazada.
4. **Cupos en tiempo real:** después de reservar, cancelar, anotarse, confirmar o salir se vuelve a pedir la clase.
5. **Lista de espera:** el servidor marca `NOTIFICADO`; el front lo ve porque el detalle y la vista "Mis clases" se actualizan cada 5 s (`useActualizacionPeriodica`, se corta al salir). "Confirmar cupo" solo aparece en `NOTIFICADO`.
6. **Socio de la sesión:** `useUsuarioSesion().socioId`. RECEPCION usa su `sedeId`; el GERENTE elige.
7. **Estado "cumplida":** lo calcula el servidor y el front lo muestra tal cual.
8. **Limitaciones del contrato:** `GET /clases` no filtra por fecha (la agenda es el listado paginado) y las reservas y esperas no traen el nombre del socio (se muestra "Socio #id").
9. **Kit:** se usa `PestanasFz` (reservas próximas / pasadas) y `CampoTextoFz` acepta `tipo="time"`.
10. **Accesibilidad:** foco visible, etiquetas en todos los campos, errores asociados con `aria-describedby`, tablas con título, pestañas con teclado.
11. **Penalidad (RF-07):** el servidor cobra la penalidad en el momento de cancelar (queda un pago y un comprobante). Después del 204 se busca el pago de la reserva (`GET /pagos?reservaClaseId=`) y se guarda como la última penalidad cobrada, junto con la clase cancelada (id, tipo y horario ya formateado), en `compartido/composables/usePenalidadCobrada` (estado de módulo, sin guardarlo en el navegador). `AvisoPenalidad` la muestra como advertencia con "Descargar comprobante" (reusa `useDescargaPdf` de M5) y un botón de cierre con ícono (nombre accesible "Cerrar aviso"). Se borra al cerrarla o al cerrar la sesión (`limpiar` y `cerrarSesion` del store de sesión). Los textos (`textosPenalidad.ts`) son verdaderos en cada momento: antes de cancelar el modal avisa en futuro ("se cobrará al instante una penalidad del 50% …", con las horas y el porcentaje de `reglas.ts`); después el cobro ya ocurrió: en el detalle de la misma clase, "Reserva cancelada. Se cobró una penalidad de $X."; en la agenda (las dos vistas) y en el detalle de otra clase, "Tu última cancelación («tipo», horario) tuvo una penalidad de $X.". En el detalle de una clase que ya comenzó no se muestra.
12. **Después de cancelar:** el detalle sigue ofreciendo las acciones normales (Reservar si hay cupo, la ventana está abierta y la clase no empezó): no hay ningún bloqueo posterior a la cancelación.
12b. **Reserva y espera vigentes:** el listado del socio puede traer también las canceladas, así que el detalle pide una página grande y se queda con la reserva `CONFIRMADA` y la espera `EN_ESPERA` o `NOTIFICADO` (`reservaVigente` / `esperaVigente`). El lugar en la cola se calcula solo para la espera vigente y se cuenta entre las vigentes de la cola (`esperasVigentes`); sin ella se ofrece "Anotarme en lista de espera" o "Reservar".
12c. **Desajuste del backend con el contrato (para el equipo):** `openapi.yaml` dice que los listados de reservas y de esperas sin `estado` traen solo las vigentes (reservas `CONFIRMADA`; esperas `EN_ESPERA` y `NOTIFICADO`), pero el backend no aplica ningún filtro por defecto y devuelve también las canceladas, ordenadas por id (reservas) o por fecha de anotación (esperas). Afecta a los cuatro listados: `GET /reservas-clases`, `GET /esperas-clases`, `GET /clases/{claseId}/reservas` y `GET /clases/{claseId}/espera`. El front se defiende filtrando en el cliente (`reservaVigente`, `esperasVigentes`, `inscriptosVigentes`) en el detalle (el lugar en la cola, la tabla de la lista de espera y la de inscriptos), en "Mis clases" y en las marcas de la agenda. Si el backend aplica el filtro del contrato, esos filtros quedan sin efecto y no hay que tocar nada.
13. **Sede del filtro:** si la dirección no trae `sede`, el filtro de la agenda arranca en "Todas las sedes" para el GERENTE y el SOCIO. El RECEPCION con sede en el token ve siempre la suya y no tiene selector (un `?sede=` de la dirección no la cambia); si no tiene sede en el token, arranca en la sede activa (`compartido/composables/useSedeActiva`, compartida con Acceso) y puede cambiarla. Elegir "Todas las sedes" a propósito se escribe `sede=todas`, distinto de no tener el parámetro, y elegir una sede en el filtro no cambia la sede activa.
14. **Nueva clase en un modal:** se abre desde la agenda (RECEPCION y GERENTE). La sede es un select obligatorio: el GERENTE arranca en "Elegí una sede" (no se precarga la sede activa) y, si no elige, el error es "Elegí la sede donde se dicta la clase." junto al campo; el RECEPCION queda en la suya, de solo lectura. Si el servidor rechaza la clase, el error se muestra dentro del modal (el 409 de horario, junto a los campos de horario). Al crearla se cierra, avisa "Clase creada" y recarga la agenda. Ya no existe la ruta `/clases/nueva`.
15. **Estado de la clase:** `estadoDeClase` (comenzada, sin cupos, con cupos) lo usan la tabla de la agenda y el encabezado del detalle. En el detalle "Sin cupos" figura una sola vez (el chip junto al título); la fila "Cupos" siempre muestra "N libres de M" en texto, y `AccionesClase` solo muestra chips propios del socio (cupo reservado, estado de su espera).
16. **Fecha pasada en el alta:** `campoConInicioPasado` (con la hora local del navegador) marca el error junto al día, o junto a la hora de inicio si el día es hoy, con los demás errores del formulario; el campo de día lleva `min` = hoy. El 409 del servidor se mantiene como respaldo (su zona horaria puede ser otra) y se muestra junto a los campos de horario.
17. **"Mis clases" dentro de "Clases":** el SOCIO ve debajo del encabezado un selector Agenda / Mis clases (`SelectorSegmentadoFz`). La vista vive en la dirección (`?vista=mis-clases`; sin query, la agenda; `useVistaClases`), así que Atrás, favoritos y recargar la conservan, y cambiarla no recarga la pantalla. `VistaMisClases` solo se monta mientras está activa. RECEPCION y GERENTE no ven el selector y un `?vista=` en su dirección se ignora.
18. **Filtros y página de la agenda en la dirección** (`direccion.ts`, `useAgendaClases`): `?tipo=` (texto de la disciplina), `?sede=` (id de sede, o `todas` para "Todas las sedes" elegida a propósito) y `?pagina=` (desde la 2). Un parámetro ausente es el valor por defecto de hoy (sede activa para el personal, todas para el socio; sin disciplina; página 1); un valor inválido o desconocido se ignora como si no estuviera. Los cambios de filtro y de página reemplazan la entrada del historial (`router.replace`), así Atrás no recorre cada selección, y cambiar un filtro vuelve a la página 1. El texto de la disciplina se escribe en la dirección con el mismo retraso de 300 ms que la búsqueda. Los parámetros de otra ruta (el detalle) no se leen como filtros.
19. **"Volver" del detalle** (`destinoVolver`): los enlaces al detalle llevan `?desde=agenda` (más los filtros de la agenda) o `?desde=mis-clases`. El detalle arma el enlace solo con la dirección, sin el historial del navegador, así que funciona igual al recargar o entrando por un enlace guardado: "Volver a la agenda" (con sus filtros) o "Volver a mis clases" (`/clases?vista=mis-clases`). `desde` se valida contra la lista cerrada `agenda` | `mis-clases`; otro valor, o `mis-clases` en alguien que no es socio, es entrada directa y vuelve a la agenda sin filtros.
20. **Marcas en la agenda del socio** (`marcasClases.ts`, `useMarcasClases`): junto al nombre de la clase, "Reservada" (con tilde) si tiene una reserva `CONFIRMADA`, "En espera" si tiene una espera `EN_ESPERA` y "Cupo disponible" si está `NOTIFICADO`. Dos consultas extra, en paralelo (las reservas `CONFIRMADA` del socio y sus esperas), al abrir la agenda y al volver de "Mis clases"; al volver del detalle la agenda se monta de nuevo. Solo el SOCIO las hace: el personal ni las ve ni consulta. Si la consulta falla, la agenda queda sin marcas.
