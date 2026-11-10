# Guía de despliegue: Aiven/TiDB (base de datos) + Render (backend) + Netlify (frontend)

Orden: **1) base de datos → 2) backend (Render) → 3) frontend (Netlify) → 4) CORS → 5) verificación**.

## 0. Importante antes de empezar: el plan gratis de MySQL de Aiven

Según la documentación de Aiven (consultada el 9-nov-2026), el plan gratuito de **MySQL se está retirando**: desde el **6 de noviembre de 2026 ya no se pueden crear servicios MySQL gratuitos nuevos**, y los existentes funcionan hasta el **21 de diciembre de 2026**, cuando se apagan y sus datos se eliminan.

- Si **ya creaste un servicio MySQL en Aiven antes del 6 de noviembre**, te sirve para la sustentación de este mes, pero **exporta tus datos antes del 21 de diciembre**.
- Si **solo creaste la cuenta y aún no el servicio**, no podrás crear uno gratis. Opciones:
  1. **TiDB Cloud Starter**: base de datos compatible con MySQL, con plan gratuito (según su documentación, hasta 5 instancias gratis por organización y 5 GiB por instancia, con escalado a cero). **No lo he probado con este proyecto**: el script SQL funciona en MariaDB/MySQL, pero valida en TiDB las tablas, llaves foráneas y vistas antes de la sustentación.
  2. Un plan de pago de Aiven (consulta el precio vigente en su sitio).
  3. Otro proveedor de MySQL que acepte conexiones externas.
- Los pasos de abajo sirven para cualquier base MySQL en la nube: solo cambian los datos de conexión.

## 1. Base de datos

1. Crea el servicio y copia sus datos de conexión: **host, puerto, usuario, contraseña y nombre de la base** (en Aiven suele ser `defaultdb`, usuario `avnadmin` y un puerto distinto de 3306). Si te ofrece un **certificado CA** (Aiven: "CA certificate"), descárgalo (`ca.pem`).
2. Importa **`Database/portal_acegrasco_nube.sql`** dentro de esa base (este script no trae `CREATE DATABASE` ni `USE`).
   - **Con DBeaver (más fácil):** nueva conexión MySQL con esos datos (pestaña SSL: activar) → clic derecho en la base → *Tools → Execute script* → elegir el archivo.
   - **Con la consola (CMD de Windows):**
     ```
     "C:\xampp\mysql\bin\mysql.exe" -h HOST -P PUERTO -u USUARIO -p --ssl-ca=ca.pem --default-character-set=utf8mb4 NOMBRE_BASE < Database\portal_acegrasco_nube.sql
     ```
3. Comprueba que existan las tablas (`usuarios`, `empleados`, `solicitudes`, `certificados`...) y que `usuarios` tenga 6 filas.

## 2. Backend en Render

1. En https://render.com → **New + → Web Service** → conecta tu repositorio de GitHub.
2. Configura:
   - **Root Directory:** `Backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. En **Environment** agrega estas variables:

| Variable | Valor |
|---|---|
| `NODE_VERSION` | `20` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | los de tu base de datos |
| `DB_SSL` | `true` |
| `DB_SSL_CA` | (opcional) contenido de `ca.pem`; puede pegarse con saltos de línea o en una sola línea con `\n` |
| `JWT_SECRET` | un texto largo y aleatorio (genera uno con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `CORS_ORIGIN` | (lo pones en el paso 4, con la URL de Netlify) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | los de Mailtrap (puerto **2525**) |
| `SMTP_SECURE` | `false` |

   > **Correo en Render gratis:** Render bloquea los puertos SMTP 25, 465 y 587, así que **Gmail (587) no funcionará**. Mailtrap con el puerto **2525** sí se puede usar.

4. **Create Web Service**. Espera el despliegue. Abre `https://TU-SERVICIO.onrender.com/`: debe mostrar el mensaje JSON de la API. Copia esa URL.
5. En los *Logs* debe aparecer "Conexion a MySQL ... establecida correctamente". Si aparece un error de SSL o de acceso, revisa las variables `DB_*`.

> `render.yaml` (en la raíz) ya describe este servicio; puedes usarlo como *Blueprint* en vez de crear el servicio a mano.

## 3. Frontend en Netlify

1. Edita **`Frontend/src/environments/environment.prod.ts`** y pon la URL de Render **terminada en `/api`**:
   ```ts
   apiUrl: "https://TU-SERVICIO.onrender.com/api"
   ```
2. Haz commit y push a GitHub (ver sugerencia de commits más abajo).
3. En https://www.netlify.com → **Add new site → Import an existing project** → elige tu repositorio. Netlify lee `netlify.toml` (carpeta base `Frontend`, comando de build y carpeta publicada `dist/frontend/browser`); no cambies nada. **Deploy**.
4. Copia la URL del sitio (por ejemplo `https://tu-sitio.netlify.app`).

## 4. Permitir al frontend llamar a la API (CORS)

En Render, edita la variable **`CORS_ORIGIN`** y pon la URL de Netlify **sin barra final** (`https://tu-sitio.netlify.app`). Guarda: Render reinicia el servicio.

## 5. Verificación

1. Abre la URL de Netlify (la primera carga puede tardar hasta un minuto: el servicio gratuito de Render estaba dormido).
2. Inicia sesión con `jltrivino@acegrasco.com` / `123456`.
3. Recarga la página en `/solicitudes`: debe cargar (si da error 404, falta la redirección de `netlify.toml`).
4. Genera un certificado por PDF y por correo; revisa la bandeja de Mailtrap.
5. Cambia la contraseña de los usuarios de ejemplo antes de compartir el enlace.

## 6. Antes de la sustentación

- **Abre el portal 5 a 10 minutos antes** e inicia sesión una vez para despertar el servicio de Render (se suspende tras 15 minutos sin uso).
- Ten **Mailtrap abierto** en otra pestaña para mostrar el correo.
- **Plan B:** el video tutorial, las capturas del manual y el proyecto corriendo en local (`localhost`).
- Exporta un respaldo de la base con `mysqldump` (con `--ssl-ca`) y guárdalo.

## 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| El login no responde o sale error de red / CORS en la consola del navegador | `CORS_ORIGIN` mal escrito o `apiUrl` incorrecto | Revisa que `CORS_ORIGIN` sea exactamente la URL de Netlify y que `apiUrl` termine en `/api` |
| Pantalla en blanco o 404 al recargar una ruta | Falta la redirección a `index.html` | Verifica que `netlify.toml` esté en la raíz del repositorio |
| Los logs de Render muestran error de conexión a MySQL | Datos `DB_*` incorrectos o falta `DB_SSL=true` | Corrige las variables; si el proveedor da CA, agrega `DB_SSL_CA` |
| "Error al conectar... self-signed certificate" | El certificado del proveedor no es público | Agrega `DB_SSL_CA` con el `ca.pem` del proveedor |
| "Enviar por correo" responde 502 o tarda mucho | Puerto SMTP bloqueado o credenciales erradas | Usa el puerto 2525 (Mailtrap) y revisa usuario y clave |
| "Enviar por correo" responde 503 | Falta `SMTP_HOST` | Define las variables `SMTP_*` |
| La primera petición tarda ~1 minuto | Arranque en frío del plan gratuito de Render | Precalienta el servicio antes de usarlo |
| Los PDF generados desaparecen | El disco de Render gratis es temporal | Es lo esperado: el PDF se entrega al instante y el historial queda en la base de datos |
