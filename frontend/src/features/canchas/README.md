# Feature Canchas (`features/canchas`)

Módulo de Canchas (M4, RF-09 a RF-12): gestión de canchas por sede, grilla de turnos, reserva con precio dinámico, cancelación y mantenimiento.

## Estructura de carpetas

```text
src/features/canchas/
├── components/
│   ├── ConfirmarReserva.vue     # Modal de confirmación (ModalFz) con el precio base
│   ├── FormularioCancha.vue     # Alta de cancha: deporte y costo por hora
│   ├── GrillaTurnos.vue         # Cada tramo es un botón con rango y estado en texto
│   ├── ListaCanchas.vue         # Tabla con deporte, estado y precio base
│   └── TablaReservas.vue        # Reservas propias con cancelar y pagar
├── composables/
│   ├── useCanchas.ts            # Canchas de la sede elegida (con useSedes)
│   ├── useGestionCanchas.ts     # Alta, costo por hora y mantenimiento (GERENTE)
│   ├── useGrillaTurnos.ts       # Cancha + disponibilidad del día
│   ├── useMisReservas.ts        # Reservas del usuario de la sesión por estado
│   └── useReservarTurno.ts      # Crea la reserva y traduce el 409
├── pages/
│   ├── GestionCanchasPage.vue   # /canchas/gestion (GERENTE)
│   ├── GrillaTurnosPage.vue     # /canchas/:canchaId/turnos
│   ├── ListaCanchasPage.vue     # /canchas
│   └── MisReservasPage.vue      # /mis-reservas
├── services/servicioCanchas.ts  # Canchas, disponibilidad y reservas contra api.d.ts
├── errores.ts                   # 409 por el campo `type` del problem+json
├── presentacion.ts              # Etiquetas, montos y fechas en hora de la sede
├── rutas.ts
├── tipos.ts
└── README.md
```

## Rutas

| Ruta | Nombre | Roles | Menú |
|---|---|---|---|
| `/canchas` | `canchas` | SOCIO, RECEPCION, GERENTE, EXTERNO | "Canchas" (orden 6) |
| `/canchas/:canchaId/turnos` | `cancha-turnos` | SOCIO, RECEPCION, GERENTE, EXTERNO | — |
| `/canchas/gestion` | `canchas-gestion` | GERENTE | — |
| `/mis-reservas` | `mis-reservas` | SOCIO, RECEPCION, GERENTE, EXTERNO | "Mis reservas" (orden 7) |

## Decisiones y reglas

1. **Arquitectura:** página → composable → servicio → cliente tipado. Las páginas solo componen; el servicio se pide con `useServicios().canchas`.
2. **`usuarioId` de la sesión:** `LoginOut` incorporó `usuarioId` y `useUsuarioSesion` lo expone. Se usa para crear la reserva y para filtrar "mis reservas".
3. **El EXTERNO también reserva:** no tiene `socioId`, pero sí `usuarioId`; el servidor lo cotiza como externo. Por eso `/canchas`, la grilla y `/mis-reservas` incluyen el rol `EXTERNO` y su ruta inicial es `/canchas`.
4. **El precio lo calcula el servidor.** `DisponibilidadEntrada` no trae precio, así que el modal muestra el `costoPorHora` como precio base y el `precioAplicado` del 201 es el definitivo.
5. **409 por el campo `type`:** `turno-ocupado` avisa "Ese turno acaba de ser tomado, elegí otro" y recarga la grilla; `cancha-en-mantenimiento` tiene su propio mensaje; al cancelar, `reserva-ya-cancelada` y `reserva-pasada` se distinguen por `type`.
6. **Mantenimiento (A):** pasar una cancha a `EN_MANTENIMIENTO` **no toca las reservas existentes**. La grilla se superpone con las reservas del día (`CONFIRMADA` + `CUMPLIDA`): esos tramos se muestran como "ocupado" y el resto como "no disponible por mantenimiento". El servidor igual responde 409 a cualquier reserva nueva.
7. **"Mis reservas":** pestañas Próximas, Canceladas (`estado=CANCELADA`) y Pasadas (`estado=CUMPLIDA`) con `PestanasFz`. La situación se deriva en el front (Próxima / En curso / Cumplida / Cancelada). "Pagar" aparece en `CONFIRMADA` y `CUMPLIDA` impagas; "Cancelar" solo si el turno **todavía no empezó** (`puedeCancelarse`), y el modal se cierra siempre para no repetir el 409.
8. **Turnos pasados:** la disponibilidad marca `inicio <= ahora` como no disponible y `POST /reservas-canchas` responde **422** `Turno pasado`. La grilla muestra esos tramos como "ya pasó" y el selector de fecha arranca en hoy.
9. **Limitaciones del contrato:** `ReservaCanchaOut` no trae la cancha (se muestra "Cancha #id") y `DisponibilidadEntrada` no trae precio.
10. **Fechas:** el `fecha` de la consulta es `YYYY-MM-DD` y las horas se formatean en `America/Argentina/Buenos_Aires`. Un reloj local de 30 s y un refresco de 60 s mantienen la situación al día.
11. **Accesibilidad:** tramos con texto completo (rango + estado), no solo color; foco visible; errores con `role="alert"`.

## Verificación

```bash
npm run type-check
npm run build
npm run test
```

Los tests de composables viven al lado del código (`*.spec.ts`). `useReservarTurno.spec.ts` cubre el 409 `turno-ocupado`, el envío del `usuarioId` y la sesión sin usuario; `presentacion.spec.ts` cubre `puedePagarse`, `puedeCancelarse`, `situacionDeReserva` y `estadoDeTurno` (pasado, ocupado y mantenimiento).
