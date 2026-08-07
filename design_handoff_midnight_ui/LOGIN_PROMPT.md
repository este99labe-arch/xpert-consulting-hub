# Midnight · Pantallas de acceso (auth)

Prompt de implementación para Claude Code. Trabaja sobre `xpert-consulting-hub`.
Complementa a `README.md` y `tokens.css` de esta misma carpeta: **todos los
tokens, radios, tipografías y reglas del sistema Midnight aplican aquí sin
excepción**. Este documento solo describe lo específico de las pantallas de
acceso.

Referencia visual: `Xpert ERP - Login Midnight.dc.html`, opción **1a — Panel
editorial**. Las opciones 1b y 1c están descartadas; ignóralas.

**Idioma: español.** Todos los textos van literales tal y como aparecen aquí.

---

## 0. Decisiones cerradas

1. **No hay SSO.** Elimina cualquier botón «Acceder con SSO corporativo»,
   separador «O BIEN» o proveedor OAuth de estas pantallas. Solo email +
   contraseña.
2. **Un único patrón de auth** para las cinco pantallas: mismo lienzo, mismo
   panel de marca, misma columna de formulario. Cambia solo el contenido de la
   columna derecha.
3. **Sin degradados de color, sin blur de fondo, sin sombras** salvo la
   permitida en diálogos. Los `bg-gradient-to-br`, los círculos `blur-3xl` y
   las `shadow-xl` de `ForgotPassword.tsx` y `ResetPassword.tsx` se eliminan.
4. **Sin `Card`** de shadcn en auth: el borde y el fondo se declaran
   directamente sobre el contenedor con tokens.

---

## 1. Logotipos de marca

Los ficheros ya existen en `src/assets/brand/`. Sobre superficie oscura se usa
**siempre la versión en negativo (blanca)**; el isotipo azul solo como marca de
agua o favicon.

| Uso | Fichero |
|---|---|
| Cabecera del panel de marca | `logo-horizontal-white.png` · alto **30 px** |
| Logo en móvil, sobre el formulario | `logo-horizontal-white.png` · alto **26 px** |
| Marca de agua del panel | `iso-white.png` · 520 px, `opacity: .035` |

Nunca uses el logotipo positivo (negro) ni el azul sobre el fondo Midnight.
`alt="XpertConsulting"` en todos los casos.

---

## 2. Layout común (`AuthLayout`)

Crea `src/layouts/AuthLayout.tsx` y monta las cinco pantallas dentro. Evita
repetir el panel de marca cinco veces.

```
<div className="min-h-screen bg-background">
  <div className="mx-auto grid min-h-screen w-full max-w-[1180px] lg:grid-cols-[1fr_452px]">
    <BrandPanel />          {/* hidden lg:flex */}
    <main>{children}</main> {/* columna de formulario */}
  </div>
</div>
```

- Lienzo: `bg-background` (`#0C0F16`).
- **Panel de marca** (izquierda, `hidden lg:flex`): fondo `sidebar`
  (`#080A10`), `position: relative`, `overflow-hidden`, padding **44 px
  vertical / 52 px horizontal**, `flex-col justify-between`.
  - Marca de agua: `iso-white.png` en `absolute`, `right:-140px`,
    `bottom:-120px`, `w-[520px]`, `opacity-[.035]`, `pointer-events-none`.
  - Halo: capa `absolute inset-0` con
    `radial-gradient(620px 420px at 12% 0%, hsl(var(--primary)/.13), transparent 70%)`,
    `pointer-events-none`. Es el **único** degradado permitido y es
    monocromo azul sobre negro, no un degradado de marca.
- **Columna de formulario** (derecha, 452 px fijos en `lg`): fondo
  `background`, contenido centrado, ancho máximo del formulario **372 px**,
  padding 44 px / 40 px.
- Por debajo de `lg` el panel de marca desaparece y la columna de formulario
  ocupa el ancho completo con el logo horizontal blanco de 26 px arriba.

### Contenido del panel de marca

Bloque central, `max-w-[430px]`, `gap: 34px`:

- **H1** `font-display` (Inter Tight) **40 px / 600**, `leading-[1.1]`,
  `tracking-[-.022em]`, color `figure` (`#F4F6FA`).
  Texto en dos líneas: `Tu negocio,` / `bajo control.`
- **Párrafo** 13 px / 400, `leading-[1.65]`, `muted-foreground`,
  `max-w-[360px]`:
  «La plataforma de gestión que reúne facturación, contabilidad y equipo en un
  único panel inteligente.»
- **Lista de tres características**, cada fila con `border-top: 1px solid
  var(--border-subtle)` (la última también `border-bottom`), padding 11 px
  vertical, `gap: 13px`. Sin fondo ni radio en la fila.
  - Icono en cuadro de **28 px**, radio 8 px, borde `border-strong`, fondo
    `secondary`; glifo lucide de 14 px, `stroke-[1.8]`, color
    `accent-foreground` (`#7FA6F0`).
  - Título 12,5 px / 600 `foreground`; descripción 11,5 px / 400
    `muted-foreground`, `leading-[1.6]`.

| Icono lucide | Título | Descripción |
|---|---|---|
| `FileText` | Facturación y VERI*FACTU | Emite, cobra y registra ante la AEAT. |
| `Calculator` | Contabilidad y tesorería | Asientos automáticos y previsión de caja. |
| `Users` | Equipo y clientes | RRHH, control horario y cartera, en un sitio. |

Pie del panel: `ShieldCheck` 14 px `stroke-[1.8]` en `faint` + texto 11,5 px
`subtle`: «Datos cifrados y conformes con el RGPD».

---

## 3. Controles de formulario (aplican a las cinco pantallas)

Ajusta `input.tsx` y `button.tsx` si hace falta, pero no rompas su uso en el
resto de la app: si el tamaño no coincide, añade una variante en vez de
cambiar la base.

- **Campo**: alto **40 px**, radio 8 px, borde `input` (`#212736`), fondo
  `muted` (`#12161F`), texto 12,5 px `foreground`, placeholder `faint`
  (`#4A5162`). Icono lucide opcional de 14 px a la izquierda en `faint`,
  `gap: 9px`, padding horizontal 12 px.
- **Foco**: borde `primary` + `ring` de 3 px `hsl(var(--primary)/.16)`. Sin
  transición de más de 120 ms.
- **Etiqueta**: 11 px / 500 `muted-foreground`, `gap: 7px` respecto al campo.
- **Contraseña**: `type` conmutable, texto oculto en `font-mono` 13 px con
  `letter-spacing: .12em`; botón `Eye` / `EyeOff` de 14 px a la derecha,
  color `faint`, hover `muted-foreground`, `tabIndex={-1}` y `aria-label`.
- **Botón primario**: ancho completo, alto **42 px**, radio 8 px, fondo
  `primary`, texto 12,5 px / 600 blanco, hover `primary-hover`. Icono
  `ArrowRight` de 14 px a la derecha en el login; sin icono en el resto.
- **Botón secundario**: alto 40 px, radio 8 px, borde `border-strong`, fondo
  `secondary`, texto 12,5 px / 500 `foreground`, hover `#1B2130`.
- **Checkbox**: 15 px, radio 5 px. Sin marcar: borde `border-strong`, fondo
  `muted`. Marcado: fondo y borde `primary`, check blanco `stroke-[3.4]`.
- **Enlace secundario** («¿Olvidaste tu contraseña?», «Volver al acceso»):
  11,5 px `muted-foreground`, hover `accent-foreground`, sin subrayado.
- **Alerta de error**: radio 8 px, borde `destructive-border`, fondo
  `destructive-surface`, texto 11,5 px `destructive-text`, `leading-[1.5]`,
  icono `AlertCircle` 14 px `stroke-[1.8]`, padding 10 px / 12 px,
  `role="alert"`.
- **Alerta de éxito**: mismos valores con `success-border`,
  `success-foreground` como fondo y `success` como color de texto; icono
  `CheckCircle2`.
- **Alerta neutra** (aviso, no error): borde `border`, fondo `muted`, texto
  11,5 px `muted-foreground`, icono `Info` en `faint`.
- **Pie legal**: 11 px `faint`, centrado, separado por
  `border-top: 1px solid var(--border-subtle)` y 20 px de padding superior:
  «© {año} XpertConsulting · Todos los derechos reservados».

---

## 4. Pantallas

### 4.1 `src/pages/Login.tsx`

Columna derecha, de arriba abajo:

1. Título `font-display` **22 px / 600**, `tracking-[-.012em]`, color
   `figure`: «Bienvenido de nuevo». Subtítulo 12,5 px `muted-foreground`:
   «Introduce tus credenciales para acceder al sistema.» `gap: 7px` entre
   ambos, 28 px hasta el formulario.
2. Alerta de error (condicional).
3. Campo **Email**, icono `Mail`, placeholder `tu@email.com`,
   `autoComplete="email"`.
4. Campo **Contraseña**, icono `Lock`, `autoComplete="current-password"`,
   conmutador de visibilidad.
5. Fila de 40 px con checkbox **«Mantener sesión»** a la izquierda y enlace
   **«¿Olvidaste tu contraseña?»** (`/forgot-password`) a la derecha.
   El checkbox es nuevo: persiste con
   `supabase.auth.signInWithPassword` + sesión persistente por defecto; si no
   está marcado, cierra sesión al cerrar la pestaña
   (`persistSession: false` en el cliente de esa sesión). Si esto complica el
   `AuthContext`, deja el control desactivado visualmente y abre un TODO en
   vez de improvisar.
6. Botón primario: «Iniciar sesión» + `ArrowRight`. En carga: `Loader2`
   girando y texto «Iniciando sesión...». `disabled` mientras carga.
7. Pie legal.

Elimina del fichero actual: el bloque de SSO si lo hubiera y el `logoWhite`
duplicado del panel (el panel de marca lo aporta `AuthLayout`); conserva el
logo de móvil (`lg:hidden`).

### 4.2 `src/pages/ForgotPassword.tsx`

Mismo `AuthLayout`. Sin `Card`, sin degradados, sin blur.

- **Estado por defecto**: título «Recuperar contraseña», subtítulo «Te
  enviaremos un enlace para restablecer tu contraseña.», campo Email,
  botón primario «Enviar enlace», y debajo del botón un enlace centrado
  `ArrowLeft` 12 px + «Volver al acceso» (`/login`).
- **Estado enviado**: sustituye el formulario por una alerta de éxito con
  `CheckCircle2` y el texto actual («Si existe una cuenta con **{email}**,
  recibirás un correo con instrucciones para restablecer tu contraseña.»), el
  email en 12,5 px / 600 `foreground`, y debajo el botón secundario «Volver al
  acceso». No repitas el `CheckCircle2` de 48 px: el icono va dentro de la
  alerta, a 14 px.

### 4.3 `src/pages/ResetPassword.tsx`

- Título «Nueva contraseña», subtítulo «Introduce tu nueva contraseña.»
- Aviso neutro cuando `!isRecovery`, con el texto actual («No se detectó un
  enlace de recuperación válido. Asegúrate de usar el enlace del correo.»).
- Campos **Nueva contraseña** y **Confirmar contraseña**, ambos con
  conmutador de visibilidad y `autoComplete="new-password"`.
- Debajo del primer campo, **medidor de robustez**: cuatro segmentos de 3 px
  de alto, radio 5 px, `gap: 4px`, fondo `chart-track`; se rellenan en
  `primary` según longitud ≥ 6, mayúscula, dígito y símbolo. Etiqueta a la
  derecha 10 px `font-mono` `muted-foreground`: DÉBIL / MEDIA / FUERTE.
  Solo aparece cuando el campo tiene contenido.
- Botón primario «Actualizar contraseña», `disabled` si `loading` o
  `!isRecovery`.
- **Estado de éxito**: alerta de éxito «Tu contraseña ha sido actualizada
  correctamente. Redirigiendo al acceso...» y redirección a `/login` a los
  3 s, como ahora.

### 4.4 Registro por invitación — **nueva** `src/pages/AcceptInvite.tsx`

Ruta `/invitacion/:token`, pública, dentro de `AuthLayout`.

- Encima del título, **chip de contexto**: radio 6 px, borde `border`, fondo
  `accent` (`#141C2C`), texto 11 px / 600 `accent-foreground`, con el nombre
  de la empresa que invita: «Invitación de {empresa}».
- Título «Crea tu cuenta», subtítulo «Completa tus datos para unirte al
  espacio de {empresa}.»
- Campo **Email** en estado bloqueado: `disabled`, fondo `muted`, texto
  `muted-foreground`, icono `Lock` 12 px a la derecha en `faint`. El valor
  viene de la invitación y no se puede editar.
- Campos **Nombre y apellidos**, **Contraseña** (con el mismo medidor de
  robustez de 4.3) y **Confirmar contraseña**.
- Casilla obligatoria: checkbox + texto 11,5 px `muted-foreground` «Acepto los
  <a>Términos de servicio</a> y la <a>Política de privacidad</a>» (enlaces a
  las rutas de `src/pages/legal/`, color `accent-foreground`). El botón
  primario está `disabled` hasta marcarla.
- Botón primario «Crear cuenta y acceder».
- **Estado de invitación inválida o caducada**: en lugar del formulario, una
  alerta de error «Esta invitación ya no es válida. Pide a tu administrador
  que te envíe una nueva.» y un botón secundario «Ir al acceso».

### 4.5 Carga y errores de sesión

- **Carga de sesión** (`AuthContext` resolviendo, guardas de ruta): pantalla
  completa `bg-background`, centrada, con `iso-white.png` a 40 px y
  `opacity: .5` sobre un `Loader2` de 14 px girando debajo en
  `muted-foreground`. Sin texto, sin barra de progreso, sin spinner de
  pantalla completa con logotipo grande.
- **Sesión caducada**: al recibir un 401 o `TOKEN_REFRESHED` fallido, redirige
  a `/login?expired=1`. Con ese parámetro, el login muestra una alerta neutra
  sobre el formulario: «Tu sesión ha caducado. Vuelve a iniciar sesión.»
- **Errores de credenciales**: mensaje único, sin distinguir si falla el email
  o la contraseña: «Credenciales incorrectas. Comprueba el email y la
  contraseña.» Los errores crudos de Supabase no se muestran nunca al usuario;
  regístralos en consola.
- **Error de red o servicio caído**: alerta de error «No se ha podido conectar
  con el servidor. Inténtalo de nuevo en unos segundos.» y el botón primario
  vuelve a estar activo.
- **Bloqueo por intentos**: si el backend devuelve `429`, alerta de error
  «Demasiados intentos. Espera un minuto antes de volver a intentarlo.» y
  botón primario `disabled` durante 60 s con cuenta atrás en `font-mono` en el
  propio botón.
- Todo estado de carga de botón usa `Loader2` girando **sustituyendo** al
  icono, nunca añadiéndose a él; el ancho del botón no cambia.

---

## 5. Accesibilidad

- Un solo `<h1>` por pantalla (el H1 del panel de marca en `lg`, el título del
  formulario cuando el panel está oculto). No dupliques niveles.
- Todos los campos con `<Label htmlFor>` real; nada de placeholder como
  etiqueta.
- Alertas con `role="alert"` y `aria-live="polite"`.
- Foco visible en todos los controles: `ring` de 3 px `primary`, nunca
  `outline: none` sin sustituto.
- Contraste comprobado: `muted-foreground` sobre `background` cumple AA para
  texto de 11,5 px o mayor; no bajes de ahí en texto informativo.

---

## 6. Orden de trabajo

1. `AuthLayout.tsx` + panel de marca (con los assets de `src/assets/brand/`).
2. `Login.tsx` sobre el layout. **Para aquí y enséñamelo.**
3. `ForgotPassword.tsx` y `ResetPassword.tsx`.
4. `AcceptInvite.tsx` y su ruta en `App.tsx`.
5. Estados de carga y error de sesión en `AuthContext` y guardas de ruta.

No toques nada fuera de `src/pages/{Login,ForgotPassword,ResetPassword,
AcceptInvite}.tsx`, `src/layouts/AuthLayout.tsx`, `src/contexts/AuthContext.tsx`
y `src/App.tsx` sin avisar antes.
