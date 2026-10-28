# Kit de componentes de FitZone (`ui/`)

Componentes de interfaz reutilizables y sin lógica de negocio. Todo lo que se usa desde afuera sale de `ui/index.ts`.

## Niveles

| Nivel | Qué es | Qué puede conocer |
| --- | --- | --- |
| Átomos | Elementos mínimos: botón, campo de texto, insignia | Tokens semánticos y de componente |
| Moléculas | Combinación de átomos con un propósito: campo con etiqueta y error | Átomos y tokens |
| Organismos | Bloques completos: tabla, formulario, encabezado | Moléculas, átomos y tokens |
| Plantillas | Estructura de página (layouts), sin datos reales | Organismos, moléculas, átomos y tokens |
| Tokens | Variables CSS de diseño (`--fz-*`) | Solo el nivel de tokens inmediatamente inferior |

Reglas centrales:

- `ui/` **no importa nada de `features/`**. La dependencia va solo de `features/` hacia `ui/`.
- Los componentes **no conocen el dominio**: nada de "socio", "reserva", "activa", etc. Ese mapeo vive en `features/`.
- Un nivel solo usa componentes del mismo nivel o de los inferiores.

## Convenciones de nombre

- PascalCase, en español, con sufijo `Fz`: `BotonFz`, `CampoTextoFz`, `InsigniaFz`.
- Un componente por archivo `.vue` dentro de la carpeta de su nivel.

## Convenciones de API

- Variantes y tamaños como props `variante` y `tamano`, tipadas con uniones de strings (`'sm' | 'md' | 'lg'`).
- Valor editable con `v-model` usando `defineModel`.
- Eventos con nombre de acción en español: `seleccionar`, `cerrar`.
- Los atributos no declarados se reenvían al elemento nativo (`disabled`, `aria-*`, `id`, `name`...).
- El contenido se pasa por slots.
- Elementos HTML nativos siempre que se pueda, con foco visible y contraste legible.

## Íconos: `IconoFz`

Átomo decorativo con trazos propios (viewBox 24x24, `stroke="currentColor"`, trazo `--fz-icono-trazo`, `aria-hidden="true"`): toma el color del texto que lo rodea.

| Prop | Tipo | Por defecto |
| --- | --- | --- |
| `nombre` | `NombreIconoFz` (unión cerrada, se exporta desde `ui/index.ts`) | requerida |
| `tamano` | `'sm' \| 'md' \| 'lg'` (1 / 1.25 / 1.5 rem, por token `--fz-icono-tamano-*`) | `'md'` |

Nombres: `carnet`, `socios`, `acceso`, `clases`, `canchas` (una cancha vista desde arriba: rectángulo, línea central y un área chica en cada extremo), `pagos`, `reportes`, `cerrar-sesion`, `menu`, `cerrar`, `acciones`, `exito`, `error`, `info`, `ojo`, `ojo-tachado`, `buscar`, `mas`, `cambiar` (dos flechas circulares), `pausa`, `reproducir`, `quitar-usuario`, `advertencia` (triángulo con exclamación), `tilde` (check simple, sin círculo), `flecha-izquierda`, `lugar` (marcador de mapa, para sedes), `correo` (sobre), `telefono` (auricular), `identificador` (numeral `#`), `editar` (lápiz), `flecha-derecha`, `reloj` (esfera con agujas), `descargar` (flecha hacia abajo sobre una bandeja: el comprobante), `salida` (puerta con una flecha que sale: registrar un egreso; no es `cerrar-sesion`). `ojo` es "ver detalle" en las acciones de las tablas. Para fechas y calendarios se reutiliza `clases`. Para sumar uno hay que agregarlo a la unión y dibujarlo en `TRAZOS` (el tipo `Record` no deja olvidarse). Al ser decorativo, el texto accesible lo pone quien lo usa (el texto vecino o un `aria-label` en el botón).

## Interruptor y avatar (átomos)

### `InterruptorFz`

Interruptor de dos estados, **controlado**: no cambia por su cuenta. Al activarlo emite `update:modelValue` con el valor contrario y el padre decide cuándo reflejarlo (típicamente después de guardar).

| Prop | Tipo | |
| --- | --- | --- |
| `modelValue` | `boolean` | Estado actual |
| `etiqueta` | `string` | Obligatoria. Nombre accesible (`aria-label`): el control no tiene texto visible |
| `deshabilitado` | `boolean` | Opcional. No emite |
| `ocupado` | `boolean` | Opcional. Mientras es `true` ignora clics y teclado, pone `aria-busy` y se ve atenuado (sin spinner) |

```vue
<InterruptorFz
  :model-value="socio.activo"
  :etiqueta="`Activar a ${socio.nombre}`"
  :ocupado="guardando"
  @update:model-value="(valor) => guardar(socio, valor)"
/>
```

- Es un `<button type="button" role="switch">` con `aria-checked`: Espacio y Enter lo alternan, sin código de teclado propio. El anillo de foco rodea la pista.
- La pista mide 2 × 1.25 rem y la perilla 1 rem; el área clickeable llega a 1.5 rem de alto (WCAG 2.5.8). Apagado usa el color de borde de controles (3:1 contra el fondo), encendido el primario, y la perilla es blanca.
- La transición usa `--fz-duracion-breve` y se desactiva con `prefers-reduced-motion: reduce`. Tokens: `--fz-interruptor-*`.

### `AvatarFz`

Cuadradito de esquinas redondeadas (el radio de control, como `MarcaFz`) con las iniciales del nombre. Es **decorativo** (`aria-hidden="true"`): el nombre siempre va escrito al lado.

| Prop | Tipo | Por defecto |
| --- | --- | --- |
| `nombre` | `string` | requerida |
| `tamano` | `'sm' \| 'md' \| 'lg'` (1.5 / 2 / 3.5 rem) | `'md'` |

`lg` (56 px) es el de las cabeceras de ficha; sus iniciales van en `--fz-texto-subtitulo` (`--fz-avatar-texto-tamano-lg`). Iniciales: la primera letra de cada una de las dos primeras palabras, en mayúsculas (`Camila Domínguez` → `CD`); con una sola palabra, solo su primera letra (`Camila` → `C`); con el nombre vacío o solo espacios, `?`. Respeta acentos y la Ñ. Tokens: `--fz-avatar-*`.

## Modal, opciones en tarjeta y botón de advertencia

Todo lo nuevo es opcional y aditivo: los usos existentes de `ModalFz` y `BotonFz` no cambian.

### `ModalFz`

`<dialog>` nativo (no Reka). Estructura: encabezado, cuerpo y, si hay slot `acciones`, un pie.

| Prop | Tipo | Por defecto |
| --- | --- | --- |
| `titulo` | `string` | requerida |
| `descripcion` | `string` | sin subtítulo; si hay, queda como `aria-describedby` |
| `icono` | `NombreIconoFz` | sin cajita de ícono |
| `tono` | `'neutro' \| 'primario' \| 'advertencia' \| 'peligro'` | `'neutro'` (color de la cajita del ícono) |
| `ancho` | `'angosto' \| 'normal' \| 'amplio'` (24 / 32 / 40 rem) | `'normal'` |
| `ocupado` | `boolean` | `false` |

- Encabezado: cajita de ícono (si hay), título, descripción (si hay) y a la derecha un botón "Cerrar" (`aria-label="Cerrar"`) que hace lo mismo que Cancelar. Separador fino debajo.
- Pie: el slot `acciones` (`{ cerrar }`, sin cambios) va sobre el fondo de superficie, con separador fino arriba y los botones a la derecha; Cancelar queda a la izquierda de la acción principal. Sin slot, no hay pie.
- Mientras `ocupado`: la X queda deshabilitada (sin fondo ni borde, solo atenuada), Esc no cierra y el modal no se cierra.
- El propio `<dialog>` no dibuja contorno cuando recibe el foco él mismo (pasa cuando no hay nada enfocable, por ejemplo con todo deshabilitado u ocupado): no es un control y el contorno solo era ruido. Los botones y campos de adentro conservan su anillo de foco.
- Foco: al abrir va al primer control del cuerpo (o la opción elegida de un grupo de radios) y, si no hay, al primer botón del pie; al cerrar vuelve a quien lo abrió.
- Fondo: velo del color de texto al 30 % con un desenfoque leve. Tokens `--fz-modal-*`.

```vue
<ModalFz v-model="abierto" titulo="Dejar de ser socio" descripcion="Camila Domínguez" icono="quitar-usuario" tono="peligro" ancho="angosto">
  <p>Se elimina la membresía del socio.</p>
  <template #acciones="{ cerrar }">
    <BotonFz variante="secundario" @click="cerrar">Cancelar</BotonFz>
    <BotonFz variante="peligro" @click="confirmar">Dejar de ser socio</BotonFz>
  </template>
</ModalFz>
```

### `OpcionesTarjetaFz` (molécula)

Grupo de opciones como tarjetas, una por fila. Es un `<fieldset>` con un `<legend>` oculto a la vista (el nombre accesible del grupo) y un `<input type="radio">` nativo por opción, dentro de un `<label>` que es la tarjeta entera. El radio está fuera de la vista pero accesible: las flechas las da el navegador y el foco de teclado dibuja un anillo sobre la tarjeta.

| Prop | Tipo | |
| --- | --- | --- |
| `v-model` | `string` | Valor elegido |
| `opciones` | `OpcionTarjetaFz[]` | `{ valor, titulo, descripcion?, etiqueta? }`; la `etiqueta` va como insignia a la derecha |
| `nombre` | `string` | `name` de los radios |
| `leyenda` | `string` | Nombre accesible del grupo |
| `deshabilitado` | `boolean` | Deshabilita todos los radios |
| `compacta` | `boolean` | Opcional. Filas compactas (ver abajo) |

Elegida: borde primario y fondo primario muy claro. Tokens `--fz-opcion-tarjeta-*`.

**Variante `compacta`** (para listas de resultados): un solo recuadro de borde marcado, con una fila por opción sin borde propio, separadas por una línea fina; el título (14 px) y la descripción (gris, por ejemplo un correo) van en la misma línea y la fila elegida toma el fondo primario muy claro. Es la misma estructura de radios nativos: lo único que cambia es el aspecto. Tokens `--fz-opcion-tarjeta-compacta-*`.

### `SelectorSegmentadoFz` (molécula)

Control segmentado de pocas opciones excluyentes (un "interruptor de modo"), siempre visible. Es un `<fieldset>` con un `<legend>` oculto a la vista (el nombre accesible del grupo) y un `<input type="radio">` nativo por opción dentro de su `<label>`; las flechas las da el navegador y el foco de teclado dibuja un anillo sobre el segmento.

| Prop | Tipo | |
| --- | --- | --- |
| `v-model` | `string` | Valor elegido |
| `opciones` | `OpcionSegmentadaFz[]` | `{ valor, etiqueta }` |
| `nombre` | `string` | `name` de los radios |
| `leyenda` | `string` | Nombre accesible del grupo |
| `deshabilitado` | `boolean` | Deshabilita el grupo entero (`fieldset disabled`) |

Los segmentos comparten el ancho. El elegido se dibuja como una pastilla blanca con el borde de los controles (`--fz-color-borde-control`, 3.3:1 contra el blanco y 3.0:1 contra la pista) sobre la pista gris; el resto va en gris suave. Tokens `--fz-selector-segmentado-*`.

```vue
<SelectorSegmentadoFz
  v-model="modo"
  nombre="modo"
  leyenda="¿El socio ya tiene cuenta?"
  :opciones="[{ valor: 'nuevo', etiqueta: 'No tiene cuenta' }, { valor: 'existente', etiqueta: 'Ya tiene cuenta' }]"
/>
```

### `EncabezadoPaginaFz` (molécula)

Encabezado de una pantalla: el mismo que usa la lista de Socios. Dibuja un `<header>` con el título en un `<h1>` (`--fz-texto-titulo`, semibold), un subtítulo opcional (`--fz-texto-cuerpo`, gris suave), un enlace opcional "← Volver a …" encima del título (el mismo estilo que el de la ficha del socio) y dos slots.

| Prop / slot | |
| --- | --- |
| `titulo` | `string`, obligatorio. Título de la pantalla, en frase ("Historial de accesos") |
| `subtitulo` | `string`, opcional |
| `volver` | `{ texto: string; a: RouteLocationRaw }`, opcional. `a` es una ruta del router (nunca `history.back()`): el destino es siempre el mismo, venga de donde venga la persona |
| slot `insignia` | Junto al título (por ejemplo, una insignia con un conteo) |
| slot `acciones` | A la derecha; en pantallas angostas se apila debajo del título |

El enlace de volver usa `<RouterLink>` **registrado globalmente por el router de la app**: el kit no importa `vue-router` (solo su tipo `RouteLocationRaw`), pero la app que lo monte tiene que haber instalado el router (en los tests, como plugin). Tokens `--fz-encabezado-pagina-*`.

```vue
<EncabezadoPaginaFz titulo="Historial de accesos" subtitulo="Ingresos y egresos de las sedes." :volver="{ texto: 'Volver al aforo', a: { name: 'acceso-aforo' } }">
  <template #acciones>
    <RouterLink v-slot="{ href, navigate }" :to="{ name: 'acceso-historial' }" custom>
      <BotonFz como="a" variante="fantasma" :href="href" @click="navigate">Historial</BotonFz>
    </RouterLink>
  </template>
</EncabezadoPaginaFz>
```

### `ListaDatosFz` (molécula)

Pares etiqueta / valor compactos (el resumen de un modal, por ejemplo). Es un `<dl>` en una grilla de dos columnas: la de las etiquetas mide la etiqueta más larga (un ancho común para todas) y el valor queda justo al lado, en peso normal y sin separarse hacia el borde derecho.

| Prop | Tipo | |
| --- | --- | --- |
| `datos` | `DatoFz[]` | `{ etiqueta, valor, destacado? }`; `destacado` agranda el valor y le da énfasis (un monto). Se exporta el tipo `DatoFz` |

La etiqueta va en gris suave (`--fz-color-texto-suave`). Tokens `--fz-lista-datos-*`.

```vue
<ListaDatosFz :datos="[{ etiqueta: 'Cancha', valor: 'Fútbol 5 #2' }, { etiqueta: 'Monto', valor: '$ 4.000,00', destacado: true }]" />
```

### `CampoFormularioFz`: obligatorio, etiqueta chica y contenido propio

Todo opcional y aditivo: sin las props nuevas el campo se ve y se comporta como siempre.

| Prop / slot | |
| --- | --- |
| `obligatorio` | Agrega un asterisco decorativo (`aria-hidden`, `--fz-campo-formulario-obligatorio-color`) a la etiqueta y `aria-required` al campo |
| `etiquetaChica` | Etiqueta en el tamaño mínimo (12 px, `--fz-campo-formulario-etiqueta-texto-chica`), para formularios densos |
| slot por defecto | Reemplaza el campo de texto por contenido propio (un `SelectFz`, por ejemplo). Recibe `{ id, describedby, invalido }` para enlazar la etiqueta, la ayuda y el error |

```vue
<CampoFormularioFz etiqueta="Sede de origen" obligatorio etiqueta-chica :error="errores.sede">
  <template #default="{ id, describedby, invalido }">
    <SelectFz :id="id" v-model="sede" :aria-describedby="describedby" :invalido="invalido" aria-required="true">…</SelectFz>
  </template>
</CampoFormularioFz>
```

### `BotonFz` con `variante="advertencia"`

Botón ámbar sólido con texto blanco (5.1:1; 7.2:1 en hover), para confirmar acciones delicadas pero reversibles, como suspender. Tokens `--fz-boton-advertencia-*`; el estado deshabilitado es el de las demás variantes.

### `BotonFz` con `variante="peligro"` (sólida) y fantasma deshabilitado

- `peligro` es **sólido** en toda la app: fondo `--fz-color-peligro`, texto blanco (5.2:1), borde del mismo color; en hover pasa a `--fz-color-peligro-hover`, un rojo más oscuro (6.7:1). Tokens `--fz-boton-peligro-*`. Es solo el botón: la variante `peligro` de `AvisoFz` y de `InsigniaFz` no cambia.
- `fantasma` deshabilitado queda **sin fondo ni borde**, solo atenuado (tokens `--fz-boton-fantasma-deshabilitado-*`): así la X de un modal ocupado no se ve como una cajita gris. Las demás variantes deshabilitadas siguen rellenándose de gris.

## Botón como enlace y campo con ícono

Dos adiciones que no cambian el uso existente.

### `BotonFz` con `como="a"`

Para navegar sin poner un botón dentro de un enlace (HTML inválido y dos paradas de tabulación). Con `como="a"` el componente dibuja un `<a class="boton ...">` con el mismo aspecto, sin `type` ni `disabled`; el `href` y el resto de los atributos llegan por atributos. El kit no conoce el router: quien lo usa le pasa el destino. Con `RouterLink` en modo `custom`:

```vue
<RouterLink v-slot="{ href, navigate }" :to="{ name: 'socios' }" custom>
  <BotonFz como="a" :href="href" @click="navigate">Ver socios</BotonFz>
</RouterLink>
```

Un enlace se activa con Enter (no con Espacio) y no puede deshabilitarse: para acciones que no navegan, seguir usando el botón.

### `BotonFz` con `soloIcono`

Prop opcional `soloIcono`: el botón queda cuadrado (del alto de su tamaño: `sm` son 1.75 rem, más que el mínimo de 24 px de WCAG 2.2, 2.5.8) y sin relleno de texto. Como no tiene texto visible, el nombre accesible es obligatorio: hay que pasar `aria-label` (en desarrollo avisa por consola si falta). Se usa con `variante="fantasma"` y `tamano="sm"`; el foco visible es el de siempre.

```vue
<BotonFz solo-icono variante="fantasma" tamano="sm" aria-label="Editar Fútbol 5 #2" title="Editar"><IconoFz nombre="editar" tamano="sm" /></BotonFz>
```

### `AccionesFilaFz` (molécula)

Las acciones de una fila de tabla. Concentra la regla en un solo lugar: según la CANTIDAD MÁXIMA de acciones que puede tener cualquier fila de esa tabla (`maximo`, no las de cada fila, para que todas se vean iguales), dibuja **botones de solo ícono** sueltos (`maximo` de 2 o menos) o **un único menú "⋯"** (`MenuAccionesFz`, con 3 o más). Va con la columna `etiquetaOculta`, `ajustada` y alineada al final.

| Prop / evento | |
| --- | --- |
| `acciones` | `AccionFilaFz[]`: `clave`, `etiqueta` (texto corto: tooltip y ítem del menú), `etiquetaAccesible?` (el `aria-label` del ícono; por defecto la `etiqueta`; la tabla la completa con el dato de la fila), `icono`, `peligro?`, `deshabilitada?`, `cargando?`, `separada?` (solo en el menú) |
| `maximo` | Cantidad máxima de acciones de cualquier fila de esa tabla |
| `etiqueta` | Nombre accesible del grupo ("Acciones de Fútbol 5 #2") |
| `identificador?` | Base para devolver el foco (ver abajo) |
| evento `seleccionar` | `(clave)`, en los dos modos. Las acciones de navegación también emiten: la tabla hace el `router.push` |

En modo íconos hay un `<div role="group">` con un botón por acción: `title` (tooltip nativo) = `etiqueta` (también en uno deshabilitado, que se ve apagado), `aria-label` = `etiquetaAccesible` y, si está `cargando`, el spinner del botón en lugar del ícono. **Foco:** cada botón lleva `data-identificador="<identificador>-<clave>"` y, en modo menú, el disparador lleva `data-identificador="<identificador>"`. Para devolver el foco al cerrar un modal abierto desde una fila, `enfocarControlDeFila(identificador, clave)` busca el botón de esa acción y, si ya no existe (se pagó, por ejemplo), el disparador del menú o el primer control habilitado que siga en esa fila.

Convención de las tablas: las acciones de cada fila son botones de solo ícono, sin la palabra "Acciones" a la vista; los nombres en las filas son texto simple y abrir un detalle es una acción más ("Ver detalle", ícono `ojo`). Única excepción: "Reservar" de la grilla de turnos, que mantiene su texto por ser la acción principal.

### `CampoTextoFz` con `icono`

Prop opcional `icono` (un `NombreIconoFz`, ej. `"buscar"`): dibuja el ícono decorativo a la izquierda, dentro del campo, y deja lugar al texto con el token `--fz-campo-icono-relleno`. Sin la prop, el componente es el `<input>` de siempre; con ella, la raíz pasa a ser un envoltorio y los atributos (`class` incluida) siguen yendo al `<input>`. El nombre accesible lo da una etiqueta o un `aria-label`, no el ícono.

```vue
<CampoTextoFz v-model="nombre" tipo="search" icono="buscar" placeholder="Buscar por nombre…" aria-label="Buscar socio por nombre" />
```

## Plantilla de la app: `PlantillaAppFz`

Armazón de las pantallas autenticadas. Los cambios son aditivos: sin las props nuevas se comporta como siempre (barra superior).

| Prop | Tipo | Por defecto |
| --- | --- | --- |
| `disposicion` | `'barra-superior' \| 'barra-lateral'` | `'barra-superior'` |
| `etiquetaNavegacion` | `string` (`aria-label` del `<nav>`) | `'Navegación principal'` |
| `textoSaltar` | `string` | `'Saltar al contenido'` |
| `textoMenu`, `etiquetaAbrirMenu`, `etiquetaCerrarMenu` | `string` (solo `'barra-lateral'`) | `'Menú'`, `'Abrir menú'`, `'Cerrar menú'` |

Slots: `encabezado` (marca), `navegacion`, `acciones`, el slot por defecto (contenido) y, nuevo, `pie`.

- `pie`: bloque que se apoya al fondo de la barra lateral (el usuario, por ejemplo). Solo se muestra con `'barra-lateral'`.
- Con `'barra-lateral'`, desde `48rem` la barra es fija (`position: sticky`, alto `100dvh`, ancho `--fz-armazon-barra-ancho`) y el contenido queda a su derecha: el scroll lo hace la página. Debajo de `48rem` pasa a ser una barra superior con un botón "Menú" (`aria-expanded` y `aria-controls`) que muestra u oculta el panel de links. Es un desplegable, no un modal: no atrapa el foco; se cierra con Escape (devuelve el foco al botón) y al activar cualquier enlace del panel.
- En ambas disposiciones se mantienen el enlace "Saltar al contenido", el `<nav>` con `aria-label` y el foco visible por tokens; los controles miden al menos `2rem` de alto (WCAG 2.2, 2.5.8).

## Plantilla centrada, marca y campo de contraseña

### `PlantillaCentradaFz`

Pantalla de una sola tarjeta centrada (hoy, el login). Props: `titulo` y `subtitulo`. Slots: el por defecto (contenido) y, opcional, `marca`: se dibuja dentro de la tarjeta, arriba del encabezado; sin él la plantilla se ve igual que antes. La tarjeta es blanca, de borde fino, radio chico y sin sombra, sobre el fondo de superficie.

### `MarcaFz` (molécula)

Cuadradito oscuro con la inicial, el nombre y, si hay, una descripción debajo (alineada con el nombre, con puntos suspensivos si no entra y el texto completo en el `title`). Es la marca de la barra lateral y del login.

| Prop | Tipo | |
| --- | --- | --- |
| `nombre` | `string` | Obligatoria |
| `descripcion` | `string` | Opcional |
| `inicial` | `string` | Opcional; por defecto, la primera letra del `nombre` |

```vue
<PlantillaCentradaFz titulo="Iniciar sesión" subtitulo="Ingresá tus credenciales para acceder.">
  <template #marca>
    <MarcaFz nombre="FitZone Sports" descripcion="Gestión de Clubes y Sedes Deportivas" />
  </template>
  <!-- formulario -->
</PlantillaCentradaFz>
```

### `CampoContraseniaFz` (molécula)

Campo de contraseña con un botón dentro, a la derecha, para mostrarla u ocultarla. Hace todo lo de `CampoFormularioFz` (etiqueta asociada con `for`, `aria-describedby` hacia la ayuda y el error, `aria-invalid`, error con `role="alert"`) y pasa el resto de los atributos (`name`, `autocomplete`…) al `<input>`.

| Prop | Tipo | |
| --- | --- | --- |
| `v-model` | `string` | Valor |
| `etiqueta` | `string` | Obligatoria |
| `error`, `ayuda`, `id` | `string` | Opcionales |
| `etiquetaBoton` | `string` | Nombre accesible del botón; por defecto `"Mostrar contraseña"` |

El botón es un `<button type="button">` de 1.75rem (por encima de los 24 px de WCAG 2.5.8), va después del campo en el orden de tabulación y tiene anillo de foco propio. Su nombre accesible **no cambia** con el estado (lo da `aria-pressed`), para que no se anuncie dos veces. Para ubicarlo dentro del campo, `CampoFormularioFz` suma un slot opcional `sufijo`: sin él, su markup es el de siempre.

```vue
<CampoContraseniaFz v-model="contrasenia" etiqueta="Contraseña" name="contrasenia" autocomplete="current-password" :error="error" />
```

## Menú de acciones y avisos flotantes (Reka UI)

`MenuAccionesFz`, `ContenedorAvisosFz` y `useAvisosFz` se apoyan en [Reka UI](https://reka-ui.com) (`reka-ui`, MIT) para lo que es difícil hacer bien a mano: foco, teclado, portales, anuncios a lectores de pantalla. **`reka-ui` se importa solo desde `ui/`**: ningún otro código lo toca, y ninguno de estos componentes importa `features/`, `app/` ni `compartido/`.

### `MenuAccionesFz` (molécula)

Botón con el ícono `acciones` que despliega un menú. No tiene lógica de negocio ni navega: avisa qué acción se eligió y la pantalla decide.

| Prop | Tipo | Descripción |
| --- | --- | --- |
| `etiqueta` | `string` | Obligatoria. `aria-label` del disparador (solo tiene un ícono), ej. `"Acciones de Camila Domínguez"` |
| `acciones` | `AccionMenuFz[]` | `{ clave, etiqueta, icono?, deshabilitada?, peligro?, separada? }`; `icono` es un `NombreIconoFz`; `separada` dibuja una línea fina antes del ítem (separador de Reka, `role="separator"`, tokens `--fz-menu-acciones-separador-*`). Sin ella el menú se ve como siempre |
| `identificador` | `string` | Opcional. Se publica en el botón disparador como `data-identificador`, para que quien lo usa pueda devolverle el foco desde afuera cuando una acción abre un modal (el ítem del menú ya no existe) |

Evento: `seleccionar(clave: string)`.

```vue
<MenuAccionesFz
  :etiqueta="`Acciones de ${socio.nombre}`"
  :acciones="[
    { clave: 'ver', etiqueta: 'Ver ficha' },
    { clave: 'bloquear', etiqueta: 'Bloquear', peligro: true, deshabilitada: !puedeBloquear },
  ]"
  @seleccionar="(clave) => ejecutar(clave, socio)"
/>
```

**Estilos sin `scoped`.** Reka dibuja envoltorios propios (el del Popper en el menú, la región del Viewport en los avisos): el atributo `data-v-…` de un `<style scoped>` cae en el envoltorio y nuestra clase en el elemento interno, que no lo recibe, así que el CSS no se aplica y el contenido se ve sin estilo. Por eso `MenuAccionesFz` y `ContenedorAvisosFz` llevan su `<style>` sin `scoped`, con clases de prefijo propio. Un componente nuevo que use Reka tiene que hacer lo mismo; `ui/estilosReka.spec.ts` lo vigila (es una comprobación estática: jsdom no aplica los estilos).

Teclado (lo da Reka): Enter, Espacio o flecha abajo abren el menú; flechas, Home y End mueven; escribir una letra salta al ítem que empieza así; Enter o Espacio eligen; Escape cierra y devuelve el foco al disparador; clic afuera cierra. El ítem con foco de teclado lleva un anillo (WCAG 1.4.11) además del fondo de resaltado. El contenido va en un portal, alineado al borde derecho del disparador y con colisión automática.

### `useAvisosFz` y `ContenedorAvisosFz` (avisos flotantes)

`ContenedorAvisosFz` se monta **una sola vez**, en `App.vue`, junto al `RouterView` (así también existe en el login). Las pantallas no lo usan: llaman a `useAvisosFz()`.

```ts
import { useAvisosFz } from '@/ui'

const avisos = useAvisosFz()
avisos.exito('Socio guardado', 'Quedó registrado en la sede Centro')
avisos.error('No se pudo guardar', 'Probá de nuevo en unos minutos')
avisos.info('Sincronizando…', undefined, 3000) // último parámetro: duración en ms
```

| Función | |
| --- | --- |
| `exito(titulo, descripcion?, duracionMs?)`, `error(...)`, `info(...)` | Agregan un aviso y devuelven su `id` |
| `cerrar(id)`, `cerrarTodos()` | Cierran uno o todos |
| `avisos` | Cola de solo lectura (un `Ref<AvisoFlotante[]>`) |

- Duración por defecto: 5000 ms éxito e info, 8000 ms error. `0` deja el aviso hasta que se lo cierre. El cierre automático lo lleva el composable; se pausa mientras el puntero o el foco están sobre el aviso.
- No se agrega un aviso idéntico (mismo tipo, título y descripción) a uno visible. Máximo 4 a la vez: al pasarse se descarta el más viejo.
- Los errores se anuncian de inmediato a los lectores de pantalla y el resto con cortesía. El viewport se llama "Avisos (F8)": F8 lleva el foco a los avisos. Abajo a la derecha en escritorio; en menos de `40rem`, a todo el ancho menos el margen.
- Los avisos y el menú van en capas propias (`--fz-capa-aviso`, `--fz-capa-menu`). `ModalFz` usa `<dialog>` con `showModal()`, que el navegador pone en la capa superior: un aviso que se dispare con un modal abierto queda detrás hasta que el modal se cierre.

## Tabla: `TablaFz`

La API y la estructura no cambian (región con foco, `<caption>`, `scope`). Cambió el estilo, solo por tokens `--fz-tabla-*`, y alcanza a todas las tablas de la app:

- Contenedor con borde fino y marcado (`--fz-color-borde-marcado`, también en los separadores de fila y el del encabezado), radio chico (el de control, 4 px) y sin sombra (`--fz-tabla-sombra: none`).
- Encabezado sobre el fondo de superficie, con texto suave en `--fz-texto-pequeno`, peso medio y relleno de 0.625 rem × 1 rem.
- Celdas con relleno de 0.5 rem × 1 rem y separadores de fila de 1 px. La celda de encabezado de fila (`encabezadoFila`) conserva el peso de énfasis (`--fz-tabla-celda-encabezado-peso`).
- Al pasar el puntero, la fila toma el fondo de superficie (`--fz-tabla-fila-fondo-hover`), sin transición. El texto suave sobre ese fondo cumple 4.5:1.

### Opciones de columna (`ColumnaTabla`)

Todas opcionales y aditivas; sin ellas la columna se comporta como siempre.

| Opción | Efecto |
| --- | --- |
| `ajustada` | La columna ocupa lo justo para su contenido; el espacio sobrante va a las columnas que no lo son |
| `alineacion` | `'inicio'` (por defecto), `'centro'` o `'fin'`, para el encabezado y las celdas |
| `encabezadoEnLineas` | El encabezado puede partirse en varias líneas, balanceadas (por defecto va en una sola) |
| `etiquetaOculta` | La etiqueta del encabezado no se ve pero la leen los lectores de pantalla (misma técnica que el título oculto de la tabla): para la columna de acciones, que tiene solo íconos |

## Escala de tamaños

La interfaz es compacta. Se cambia solo en los tokens; las pantallas la heredan.

| Token semántico | Valor | Para qué |
| --- | --- | --- |
| `--fz-texto-minimo` | 0.75rem (12 px) | Piso: detalles, insignias, títulos de sección, botones `sm` |
| `--fz-texto-pequeno` | 0.8125rem (13 px) | Texto de la interfaz: menú, tablas, botones, campos, avisos |
| `--fz-texto-cuerpo` | 0.875rem (14 px) | Texto corrido y base del `body`; controles `lg` |
| `--fz-texto-titulo` | 1.25rem (20 px) | Títulos de pantalla y de modal |

| Control (botón, campo de texto, select) | Alto | Texto |
| --- | --- | --- |
| `sm` | 1.75rem (28 px) | `texto-minimo` |
| `md` (estándar) | 2rem (32 px) | `texto-pequeno` |
| `lg` | 2.25rem (36 px) | `texto-cuerpo` |

| Espaciado semántico | Valor | Para qué |
| --- | --- | --- |
| `--fz-espaciado-minimo` | 0.25rem (4 px) | Separaciones mínimas: entre líneas de un mismo bloque |
| `--fz-espaciado-compacto` | 0.5rem (8 px) | Separación entre elementos vecinos |
| `--fz-espaciado-base` | 1rem (16 px) | Relleno y separación estándar |
| `--fz-espaciado-amplio` | 1.5rem (24 px) | Relleno de tarjetas y separación entre secciones |

Reglas:

- **Ningún texto legible por debajo de 12 px** (`0.75rem`).
- **Ningún control por debajo de 24 px de alto** (WCAG 2.2 AA, 2.5.8): hoy el mínimo es 28 px (`sm` y los links del armazón).
- Los tamaños se piden por token semántico; los primitivos de texto (`--fz-prim-texto-*`) no se usan fuera de `ui/tokens/`.

## Tokens

Viven en `ui/tokens/` y tienen tres niveles:

1. **Primitivos** (`--fz-prim-*`): valores crudos de la paleta y las escalas. Es el único lugar con colores literales.
2. **Semánticos** (`--fz-color-*`, `--fz-fuente-*`...): significado de cada valor. Referencian solo primitivos. Un modo oscuro se hace reasignando esta capa.
3. **De componente** (`--fz-boton-*`...): decisiones por átomo. Referencian solo semánticos.

Archivos: `primitivos.css`, `semanticos.css` y los de componente, partidos por nivel (cada uno por debajo de 300 líneas): `componentes-atomos.css` (botón, campos, insignia, aviso, ícono, avatar, interruptor, select, QR), `componentes-moleculas.css` (menú de acciones, marca, campo de contraseña, paginación, opción en tarjeta, selector segmentado, campo de formulario), `componentes-organismos.css` (avisos flotantes, tabla, modal) y `componentes-plantillas.css` (armazón de la app y plantilla centrada). `index.css` los importa en ese orden. Un token nuevo va en el archivo de su nivel.

Un componente **nunca** usa primitivos ni colores literales: solo tokens de componente o semánticos. Tampoco se escriben valores de respaldo dentro de `var()` (`var(--fz-color-fondo, #fff)`): si el token no existe, hay que definirlo.

Pares de color con poco margen (no tocar uno de los dos sin volver a medir): el texto de `AvisoFz` y de `InsigniaFz` en `peligro` es `--fz-color-peligro` sobre `--fz-color-peligro-fondo` (`#c53b32` sobre `#fdebec`, **4.52:1**, el mínimo de AA es 4.5:1); el de `advertencia` es `#9a610f` sobre `#fdf5e8` (4.74:1). Aclarar el rojo del texto o oscurecer el fondo rosado lo deja por debajo.

Otros pares medidos con poco margen (valores de la ficha del socio y del menú de acciones): el ítem de menú en `peligro` sobre su fondo de resaltado es `#c53b32` sobre `#f1f1ef` (**4.59:1**: no tocar el rojo ni `--fz-color-hover`); el botón sólido dentro de un `AvisoFz` se separa del fondo del aviso con 4.52:1 (`primario` sobre el rosado de `peligro`) y 4.74:1 (`advertencia` sobre el ámbar; mínimo 3:1 para elementos no textuales). El texto de vigencia en rojo (`#c53b32`) o ámbar (`#9a610f`) sobre el fondo blanco de la tarjeta da 5.19:1 y 5.13:1; el gris suave de etiquetas e íconos, 5.41:1.

Pares medidos en el selector segmentado y las opciones compactas (no tocar uno de los dos sin volver a medir): el borde de la pastilla elegida (`#8c8b87`) contra la pista gris (`#f1f1ef`) da **3.02:1**, justo el mínimo de 3:1 para un indicador de estado; el texto del segmento sin elegir (gris suave sobre la pista), 4.79:1; y el correo gris de una fila elegida (`#6b6a66` sobre el primario muy claro `#eef5fc`), **4.92:1**. El asterisco de campo obligatorio (rojo de peligro, 12 px) sobre blanco da 5.19:1.

Los tokens los cambia solo quien lleva el kit; los demás piden el cambio.

## Cómo agregar un componente

1. Mirar `ui/index.ts` por si ya existe algo equivalente.
2. Crearlo en la carpeta de su nivel (`atomos/`, `moleculas/`, `organismos/` o `plantillas/`), respetando las convenciones de arriba.
3. Exportarlo desde `ui/index.ts`.
4. Santino lo revisa en el PR.
