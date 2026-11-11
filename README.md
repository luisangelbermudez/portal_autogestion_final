# Portal de Autogestión

Proyecto formativo SENA — Tecnología en Análisis y Desarrollo de Software (Ficha 3186635)
Evidencias GA8-220501096-AA1-EV01 y AA1-EV02

## Arquitectura

```
portal_autogestion/
├── Backend/     -> API REST en Node.js + Express
├── Frontend/    -> Aplicación web en Angular
└── Database/    -> Script SQL de la base de datos (MySQL)
```

- **Backend:** Node.js, Express, mysql2, PDFKit (generación de certificados en PDF)
- **Frontend:** Angular (standalone components), Angular Router, HttpClient
- **Base de datos:** MySQL (portal_acegrasco), gestionada con XAMPP/phpMyAdmin
- **Testing de API:** Postman (colección en `Backend/postman/`) y pruebas automáticas con Jest/Supertest (`npm test`)

## Requisitos previos

- Node.js 18+ y npm instalados
- XAMPP con MySQL corriendo
- Angular CLI (`npm install -g @angular/cli`) — opcional si usas `npx ng`

## 1. Base de datos

1. Abre phpMyAdmin (`http://127.0.0.1/phpmyadmin`).
2. Ve a la pestaña "Importar" y selecciona el archivo `Database/portal_acegrasco.sql`.
3. Esto crea la base de datos `portal_acegrasco` con todas sus tablas y datos de ejemplo.
4. Si ya tenías la base creada con una versión anterior, no la vuelvas a importar: ejecuta una sola vez `Database/migracion_ultimo_acceso.sql` (pestaña SQL de phpMyAdmin) para agregar la columna `ultimo_acceso` que usa la tarjeta del empleado en Certificados.

## 2. Backend (Express)

```bash
cd Backend
npm install
copy .env.example .env      (en Windows; o "cp .env.example .env" en Mac/Linux)
```

Edita el archivo `.env` con tus credenciales reales de MySQL y define `JWT_SECRET` (clave larga y secreta para firmar las sesiones). Para enviar certificados por correo, completa las variables `SMTP_*` (ver comentarios dentro de `.env.example`); si se dejan vacías, la opción "Enviar por correo" avisa que no está configurada.

Si tu base de datos ya existía con contraseñas en texto plano, conviértelas a hash una sola vez con `npm run hash-passwords`.

```bash
npm run dev
```

El servidor queda disponible en: **http://localhost:3000**

## 3. Frontend (Angular)

```bash
cd Frontend
npm install
npx ng serve
```

La aplicación queda disponible en: **http://localhost:4200**

## Endpoints principales de la API

| Recurso | Base URL | Quién puede usarlo |
|---|---|---|
| Login | POST http://localhost:3000/api/login | Público (devuelve un token) |
| Cambiar contraseña | PUT http://localhost:3000/api/login/contrasena | Cualquier usuario con sesión |
| Usuarios | http://localhost:3000/api/usuarios | Solo Administrador |
| Empleados | http://localhost:3000/api/empleados | Administrador; el empleado solo su propio perfil |
| Solicitudes | http://localhost:3000/api/solicitudes | Empleado (las suyas) y Administrador (todas; responde y cambia estado) |
| Certificados | http://localhost:3000/api/certificados | Cada persona genera y consulta solo los suyos; el Administrador ve el listado |

**Autenticación:** todas las rutas, salvo el login, exigen el encabezado `Authorization: Bearer <token>`. El token se obtiene en `POST /api/login` y vence a las 8 horas. Las contraseñas se guardan con hash (bcrypt) y tras 5 intentos fallidos de login se bloquea el ingreso 10 minutos.

## Login y roles

- La aplicación inicia en `/login`. Usa cualquier correo de la tabla `usuarios` con contraseña `123456` (por ejemplo `jltrivino@portalautogestion.com`, rol Administrador).
- Los usuarios con rol **Administrador** ven el menú completo (Usuarios, Empleados, Solicitudes, Certificados) y un dashboard con estadísticas globales. Al rechazar una solicitud deben escribir el motivo, que el empleado ve en su tabla.
- Los usuarios con rol **Empleado** solo ven Solicitudes y Certificados (propios), con un dashboard personalizado con sus propios datos y estadísticas.
- Todos pueden cambiar su contraseña con el botón de la llave en la barra superior.

## Despliegue en la nube

El proyecto incluye `netlify.toml` (frontend), `render.yaml` (backend) y `Database/portal_acegrasco_nube.sql`. El paso a paso, con las limitaciones de los planes gratuitos, está en **`GUIA_DESPLIEGUE.md`**.

## Pruebas

```bash
cd Backend
npm test                      # 19 pruebas automáticas (no necesitan MySQL)
```

Para la colección de Postman: importar `Backend/postman/Portal_Autogestion.postman_collection.json`, encender el backend y ejecutar la colección completa (la carpeta 1 guarda los tokens).

## Scripts de base de datos

| Archivo | Cuándo usarlo |
|---|---|
| `Database/portal_acegrasco.sql` | Instalación nueva (ya incluye `ultimo_acceso`, contraseñas con hash y UNIQUE en el consecutivo) |
| `Database/migracion_ultimo_acceso.sql` | Base existente que aún no tiene la columna `ultimo_acceso` |
| `Database/migracion_v3_seguridad.sql` | Base existente: agrega UNIQUE al consecutivo de certificados |
| `Database/migracion_datos_personales.sql` | Base existente: agrega tipo y número de documento, nombres, apellidos y género a `usuarios` |

## Carga masiva de empleados (Excel)

En el módulo **Empleados** (solo Administrador) hay una sección "Carga masiva de empleados" donde se puede subir un archivo `.xlsx` con las columnas:

```
nombre | correo | contrasena | cedula | cargo | area | fechaIngreso | salario | promedioHorasExtras
```

Por cada fila se crea automáticamente el **usuario de acceso** (rol Empleado) y el **empleado** asociado, en una sola operación. Se incluye una plantilla de ejemplo en `Backend/plantilla_carga_empleados.xlsx`.

## Notas

- JavaScript/Node.js es un lenguaje interpretado: no genera archivos "compilados" como en Java. El código fuente se ejecuta directamente con el comando `node` (o `nodemon` en modo desarrollo).
- Los certificados en PDF generados se guardan temporalmente en `Backend/certificados/` (carpeta excluida del control de versiones).
