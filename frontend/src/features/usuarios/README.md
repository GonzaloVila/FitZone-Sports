# Feature `usuarios`

Pantalla **Personal** (`/personal`, solo GERENTE): lista los recepcionistas, de a diez por página, con búsqueda por
nombre y alta en un modal. El nombre buscado y la página viven en la dirección (`?nombre=`, `?pagina=N` desde la 2) y
cada cambio reemplaza la entrada del historial (`direccion.ts`, mismo patrón que Clases).

- `pages/GestionPersonalPage.vue`: arma la pantalla; no hace consultas.
- `composables/useListaPersonal.ts`: listado, filtro y página (dirección ↔ consulta). `useAltaPersonal.ts`: alta.
- `validacionPersonal.ts`: validación del formulario y reparto de errores del servidor por campo.
- `services/servicioUsuarios.ts`: llamadas a `/usuarios` según `docs/openapi.yaml`.

Limitación conocida: un recepcionista sin sede muestra la insignia "Sin sede" y hoy la asignación no se puede cambiar
por API.
