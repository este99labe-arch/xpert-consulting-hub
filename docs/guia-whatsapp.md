# Guía para conectar WhatsApp con XpertConsulting

Esta guía te explica, paso a paso y sin tecnicismos, cómo conectar tu número de
**WhatsApp Business** con el portal de **XpertConsulting**, para que puedas recibir
y responder los mensajes de tus clientes desde la sección **Chat**.

> ⏱️ **Tiempo estimado:** 30–45 minutos.
> 🧑‍💻 **Nivel:** principiante. Solo tienes que copiar y pegar unos datos.

---

## 🎯 Qué vas a conseguir

- Tus clientes te escriben a tu WhatsApp de empresa → los mensajes **aparecen en XpertConsulting**.
- Respondes desde el ordenador → le llega el WhatsApp **al cliente**.
- Un **bot** responde solo al primer mensaje y **crea tareas** automáticamente.

---

## ✅ Antes de empezar necesitas

1. Una cuenta de **Facebook** (personal, sirve la que ya uses).
2. Un **número de teléfono** para tu WhatsApp de empresa que **NO** esté usándose ya
   en la app normal de WhatsApp ni en WhatsApp Business del móvil. *(Puede ser un número
   nuevo, un fijo, o uno que borres antes de la app de WhatsApp del móvil.)*
3. Ser **administrador** en tu cuenta de XpertConsulting.

> 💡 Si no tienes un número libre, puedes empezar con el **número de prueba gratuito**
> que Meta te da para hacer pruebas, y cambiarlo por el tuyo más adelante.

---

## Parte 1 · Crear tu cuenta de desarrollador en Meta

1. Entra en 👉 **[developers.facebook.com](https://developers.facebook.com)** e inicia sesión con tu Facebook.
2. Arriba a la derecha, pulsa **"Empezar" / "Comenzar"** y sigue los pasos
   (te pedirá confirmar tu correo y para qué lo vas a usar → elige **"Empresa / Negocio"**).

---

## Parte 2 · Crear la aplicación

1. Ve a **Mis aplicaciones** (arriba a la derecha) → **"Crear aplicación"**.
2. Cuando pregunte el tipo, elige **"Empresa"** (Business).
3. Ponle un nombre (por ejemplo *"WhatsApp XpertConsulting"*) y crea la app.
4. En la pantalla de la app, busca el producto **"WhatsApp"** y pulsa **"Configurar"**.
   - Si te pide una **cuenta de empresa (Business)**, crea una: solo hay que poner el
     nombre de tu empresa.

Ya tienes WhatsApp activado en tu app. 🎉

---

## Parte 3 · Copiar tus 3 datos clave

Dentro de tu app, entra en **WhatsApp → Configuración de la API** (o "API Setup").
Ahí verás lo siguiente. Ve **copiando cada dato en un bloc de notas**, lo pegarás luego en XpertConsulting:

| Dato en Meta | Cómo se llama en XpertConsulting |
|---|---|
| **Identificador del número de teléfono** (*Phone number ID*) | **Phone Number ID** |
| El número de teléfono que se muestra | **Número visible** |
| **Token de acceso** (*temporal, dura 24h*) | **Access Token** *(ver aviso abajo)* |

> ⚠️ **Importante sobre el Access Token:** el que aparece aquí **caduca en 24 horas**
> (solo sirve para probar). Para que funcione siempre, hay que crear un **token permanente**
> (Parte 4). Si solo quieres probar hoy, puedes usar el temporal.

---

## Parte 4 · Crear un token permanente (para que no caduque)

Esto se hace una sola vez:

1. Ve a **[business.facebook.com/settings](https://business.facebook.com/settings)**
   (Configuración del negocio).
2. En el menú, entra en **Usuarios → Usuarios del sistema**.
3. Pulsa **"Agregar"**, ponle un nombre (ej. *"Integración XpertConsulting"*) y rol **Administrador**.
4. Con ese usuario seleccionado, pulsa **"Generar token nuevo"**:
   - Elige tu aplicación (la que creaste en la Parte 2).
   - Marca los permisos **`whatsapp_business_messaging`** y **`whatsapp_business_management`**.
   - Genera el token y **cópialo** (¡solo se muestra una vez! guárdalo bien).
5. Asigna el activo: en el usuario del sistema → **"Agregar activos" → Aplicaciones** →
   selecciona tu app → dale control total.

Ese token que has copiado es tu **Access Token permanente**. Úsalo en XpertConsulting.

---

## Parte 5 · Conectar el "webhook" (el enlace entre Meta y XpertConsulting)

El *webhook* es simplemente la dirección a la que Meta envía los mensajes que te llegan.

> ⚠️ **MUY IMPORTANTE (evita el error más común):** antes de verificar en Meta,
> en **XpertConsulting → Configuración → WhatsApp** activa el interruptor
> **"Integración activa"** y pulsa **"Guardar configuración"**. Si está desactivada,
> Meta dará el error *"No se pudo validar la URL de devolución de llamada o el token"*.

1. En **XpertConsulting → Configuración → WhatsApp**: activa **"Integración activa"**,
   pega tu **Token de verificación** (ver paso 2) y **Guarda**. Copia también la
   **"URL del Webhook"** 📋.
2. **Inventa una contraseña** cualquiera (letras y números, sin espacios), por ejemplo
   `xpert2026seguro`. La llamaremos **Token de verificación**. Apúntala y ponla también
   en XpertConsulting (paso 1) antes de continuar.
3. Vuelve a Meta → tu app → **WhatsApp → Configuración** → apartado **Webhook** →
   pulsa **"Editar"**:
   - **URL de devolución de llamada (Callback URL):** pega la URL del webhook de XpertConsulting.
   - **Token de verificación:** escribe **exactamente** la misma contraseña del paso 2.
   - Pulsa **"Verificar y guardar"**. *(Debe salir en verde. Si falla, revisa el punto de "Solución de problemas".)*
4. Justo debajo, en **"Campos del webhook"**, busca **`messages`** y pulsa **"Suscribir"**.

---

## Parte 6 · Pegar todo en XpertConsulting

En **XpertConsulting → Configuración → WhatsApp**, rellena:

- ✅ **Integración activa:** actívala.
- **Phone Number ID:** el de la Parte 3.
- **Número visible:** tu número (ej. `+34 600 000 000`).
- **Access Token permanente:** el de la Parte 4.
- **Token de verificación:** la contraseña que inventaste en la Parte 5.

Pulsa **"Guardar configuración"**. ¡Listo! ✅

---

## Parte 7 · Probar que funciona

1. Desde **otro** teléfono, envía un WhatsApp a tu número de empresa.
2. En unos segundos debería aparecer la conversación en **XpertConsulting → Chat**.
3. Responde desde el Chat → el otro teléfono debe recibir tu mensaje.

> 📌 **Regla de WhatsApp (ventana de 24h):** puedes responder libremente durante las
> **24 horas** siguientes al último mensaje del cliente. Pasado ese tiempo, para volver a
> escribirle primero, WhatsApp exige usar "plantillas" aprobadas (lo añadiremos más adelante).

---

## Parte 8 · Configurar el bot (opcional, recomendado)

En la misma pantalla de **Configuración → WhatsApp** puedes personalizar:

- **Mensaje de bienvenida:** lo que responde el bot al primer mensaje.
- **Intenciones (reglas):** listas de palabras clave. Por ejemplo, si el cliente escribe
  *"presupuesto"* o *"cita"*, el bot lo detecta como **solicitud** y **crea una tarea**
  automáticamente, asignada a quien tú decidas.
- **Responsable por defecto:** a quién se asignan las tareas si ninguna regla encaja.
- **Plantilla "tarea completada":** el mensaje que recibe el cliente por WhatsApp cuando
  marcas su tarea como completada.

---

## 🆘 Solución de problemas

- **"No se pudo validar la URL de devolución de llamada o el token de verificación"**
  (el error más habitual al pulsar *Verificar y guardar*): casi siempre es porque la
  **"Integración activa" está apagada** en XpertConsulting. Actívala, **Guarda**, y
  vuelve a verificar en Meta. Comprueba además que el *Token de verificación* es
  **idéntico** en Meta y en XpertConsulting (mayúsculas/minúsculas incluidas).
- **"No llegan los mensajes al Chat":** revisa que te has **suscrito al campo `messages`**
  (Parte 5, paso 4) y que el **Access Token** es el permanente (no el de 24h).
- **"No puedo responder / da error al enviar":** casi siempre es el **Access Token caducado**;
  vuelve a la Parte 4 y genera uno permanente.
- **"Han pasado más de 24h y no puedo escribir yo primero":** es normal, es una norma de
  WhatsApp; espera a que el cliente escriba o usa una plantilla aprobada.

---

## 📖 Glosario rápido

- **Phone Number ID:** el "DNI" de tu número dentro de Meta (no es el número en sí).
- **Access Token:** la "llave" que permite a XpertConsulting enviar mensajes por ti.
- **Webhook:** la dirección a la que Meta manda los mensajes entrantes.
- **Token de verificación:** una contraseña que tú inventas para que Meta y XpertConsulting
  se reconozcan.

---

### Nota para el equipo técnico de XpertConsulting

Antes de que los clientes usen esto, en el proyecto Supabase debe estar:
- Desplegada la función `whatsapp_webhook` (`supabase functions deploy whatsapp_webhook`).
- Configurado el secreto **`WHATSAPP_APP_SECRET`** (App Secret de Meta) para validar la
  firma de los mensajes entrantes. Si cada cliente usa su propia app de Meta, este secreto
  debe gestionarse por cuenta (mejora pendiente); el *Access Token* ya se guarda por cuenta.
