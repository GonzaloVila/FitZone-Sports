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

Nombres: `carnet`, `socios`, `acceso`, `clases`, `canchas`, `pagos`, `reportes`, `cerrar-sesion`, `menu`, `cerrar`, `acciones`, `exito`, `error`, `info`, `ojo`, `ojo-tachado`, `buscar`, `mas`, `cambiar` (dos flechas circulares), `pausa`, `reproducir`, `quitar-usuario`. Para sumar uno hay que agregarlo a la unión y dibujarlo en `TRAZOS` (el tipo `Record` no deja olvidarse). Al ser decorativo, el texto accesible lo pone quien lo usa (el texto vecino o un `aria-label` en el botón).

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
| `tamano` | `'sm' \| 'md'` (1.5 / 2 rem) | `'md'` |

Iniciales: la primera letra de cada una de las dos primeras palabras, en mayúsculas (`Camila Domínguez` → `CD`); con una sola palabra, solo su primera letra (`Camila` → `C`); con el nombre vacío o solo espacios, `?`. Respeta acentos y la Ñ. Tokens: `--fz-avatar-*`.

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
| `acciones` | `AccionMenuFz[]` | `{ clave, etiqueta, icono?, deshabilitada?, peligro? }`; `icono` es un `NombreIconoFz` |

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

- Contenedor con borde fino, radio chico (el de control, 4 px) y sin sombra (`--fz-tabla-sombra: none`).
- Encabezado sobre el fondo de superficie, con texto suave en `--fz-texto-pequeno`, peso medio y relleno de 0.625 rem × 1 rem.
- Celdas con relleno de 0.5 rem × 1 rem y separadores de fila de 1 px. La celda de encabezado de fila (`encabezadoFila`) conserva el peso de énfasis (`--fz-tabla-celda-encabezado-peso`).
- Al pasar el puntero, la fila toma el fondo de superficie (`--fz-tabla-fila-fondo-hover`), sin transición. El texto suave sobre ese fondo cumple 4.5:1.

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

Reglas:

- **Ningún texto legible por debajo de 12 px** (`0.75rem`).
- **Ningún control por debajo de 24 px de alto** (WCAG 2.2 AA, 2.5.8): hoy el mínimo es 28 px (`sm` y los links del armazón).
- Los tamaños se piden por token semántico; los primitivos de texto (`--fz-prim-texto-*`) no se usan fuera de `ui/tokens/`.

## Tokens

Viven en `ui/tokens/` y tienen tres niveles:

1. **Primitivos** (`--fz-prim-*`): valores crudos de la paleta y las escalas. Es el único lugar con colores literales.
2. **Semánticos** (`--fz-color-*`, `--fz-fuente-*`...): significado de cada valor. Referencian solo primitivos. Un modo oscuro se hace reasignando esta capa.
3. **De componente** (`--fz-boton-*`...): decisiones por átomo. Referencian solo semánticos.

Un componente **nunca** usa primitivos ni colores literales: solo tokens de componente o semánticos.

Los tokens los cambia solo quien lleva el kit; los demás piden el cambio.

## Cómo agregar un componente

1. Mirar `ui/index.ts` por si ya existe algo equivalente.
2. Crearlo en la carpeta de su nivel (`atomos/`, `moleculas/`, `organismos/` o `plantillas/`), respetando las convenciones de arriba.
3. Exportarlo desde `ui/index.ts`.
4. Santino lo revisa en el PR.
