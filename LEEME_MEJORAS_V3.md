# Mejoras v3 – cómo aplicarlas (paso a paso)

## Qué trae esta versión

| # | Mejora | Dónde |
|---|---|---|
| 1 | Sesión con token (JWT), roles verificados en el servidor y cada empleado solo accede a sus datos | `Backend/src/utils/auth.js` y rutas/controladores |
| 2 | Contraseñas con hash (bcrypt) + conversión automática de las antiguas + bloqueo tras 5 intentos fallidos | `utils/passwords.js`, `utils/limitador.js`, `scripts/hash-passwords.js` |
| 3 | Envío real de certificados por correo (Nodemailer/SMTP). Sin SMTP configurado avisa con honestidad y no registra el certificado | `utils/mailer.js` |
| 4 | Validación de entradas y errores claros (409 por duplicados, sin mostrar el error técnico) | `utils/validaciones.js`, `utils/errores.js` |
| 5 | UNIQUE en el consecutivo + reintento automático si dos personas generan a la vez | SQL + `certificadosController.js` |
| 6 | Rechazo con motivo (tabla `respuestas`), estado "En revisión" y columna Respuesta | Solicitudes (backend y pantalla) |
| 7 | Cambio de contraseña (botón de la llave en la barra superior) | Frontend `cambiar-contrasena` |
| 8 | Fechas en español de Colombia (a. m. / p. m.) | `app.config.ts` |
| 9 | Pruebas: 19 automáticas (Jest) + colección de Postman (27 peticiones) | `Backend/tests`, `Backend/postman` |

## PASO A PASO EN MYSQL (phpMyAdmin / XAMPP)

> **Antes de empezar:** haz un respaldo. En phpMyAdmin: base `portal_acegrasco` → pestaña **Exportar** → **Continuar**. Guarda el archivo `.sql`.

**Caso A – Ya tienes la base `portal_acegrasco` con datos (lo normal):**

1. Abre phpMyAdmin → clic en la base **portal_acegrasco** (columna izquierda) → pestaña **SQL**.
2. Si **no** has ejecutado antes la mejora de "último ingreso": abre `Database/migracion_ultimo_acceso.sql`, copia todo, pégalo y pulsa **Continuar**. (Si dice *Duplicate column name 'ultimo_acceso'*, ya la tenías: sigue al paso 3.)
3. **Verifica que no haya consecutivos repetidos.** Pega y ejecuta:
   ```sql
   SELECT consecutivo, COUNT(*) AS veces FROM certificados GROUP BY consecutivo HAVING COUNT(*) > 1;
   ```
   - Si devuelve **0 filas**: sigue al paso 4.
   - Si devuelve filas: corrige esos números (cada certificado debe tener un consecutivo distinto) con un `UPDATE certificados SET consecutivo = ... WHERE id_certificado = ...` y vuelve a ejecutar la consulta hasta que dé 0 filas.
4. Abre `Database/migracion_v3_seguridad.sql`, copia todo, pégalo en la pestaña **SQL** y pulsa **Continuar**. Debe decir "La consulta se ejecutó correctamente". Esto crea la restricción UNIQUE.
5. Verifica: pestaña **Estructura** de la tabla `certificados` → **Índices** → debe aparecer `uq_certificados_consecutivo` (Único: Sí).
6. Las contraseñas se convierten a hash con el backend (paso siguiente). No se tocan desde MySQL.

**Caso B – Base nueva o sin datos importantes:**

1. phpMyAdmin → **Importar** → elige `Database/portal_acegrasco.sql` → **Continuar**. Ya trae todo (incluidas las contraseñas con hash; la clave de los usuarios de ejemplo sigue siendo `123456`).

## Backend

```bash
cd Backend
npm install
copy .env.example .env      # y edítalo: DB_PASSWORD, JWT_SECRET (texto largo y aleatorio)
npm run hash-passwords      # SOLO si la base ya existía: convierte las claves viejas a hash
npm run dev
```

- Si olvidas `hash-passwords`, no pasa nada grave: cada usuario con clave antigua se convierte a hash automáticamente en su siguiente ingreso.
- **Correo real con Gmail:** activa la verificación en 2 pasos, crea una *contraseña de aplicación* y en el `.env` pon `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=tucorreo@gmail.com`, `SMTP_PASS=<contraseña de aplicación>`, `SMTP_FROM="Acegrasco S.A. <tucorreo@gmail.com>"`. Necesita internet en la sustentación; lleva el PDF descargable como plan B.
- **Pruebas:** `npm test`.

## Frontend

```bash
cd Frontend
npm install
npx ng serve
```

Las sesiones anteriores quedan inválidas: cada usuario debe volver a iniciar sesión una vez.

## Importante: la app Android

La API ahora exige el token. La app Android debe (1) guardar el campo `token` de la respuesta del login y (2) enviarlo en cada petición. Con OkHttp:

```kotlin
class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenProvider()
        val request = if (token != null)
            chain.request().newBuilder().header("Authorization", "Bearer $token").build()
        else chain.request()
        return chain.proceed(request)
    }
}
// OkHttpClient.Builder().addInterceptor(AuthInterceptor { sesion.token }).build()
```

La respuesta del login conserva los campos anteriores (`mensaje`, `usuario`) y agrega `token`.

## Sugerencia de commits (separados y descriptivos)

1. `feat(db): UNIQUE en consecutivo de certificados y contraseñas con hash en datos de ejemplo`
2. `feat(auth): sesión con JWT, roles verificados en backend y hash de contraseñas con bcrypt`
3. `feat(api): validación de entradas y manejo de errores sin exponer detalles técnicos`
4. `feat(certificados): envío real por correo con Nodemailer y reintento del consecutivo`
5. `feat(solicitudes): rechazo con motivo, estado En revisión y columna de respuesta`
6. `feat(frontend): interceptor de token, cambio de contraseña y fechas en español`
7. `test: pruebas con Jest y colección de Postman`

## Lo que NO se cambió (límites conocidos)

- Los certificados no llevan firma digital ni código de verificación.
- Las tablas no tienen paginación ni búsqueda.
- Falta el despliegue en la nube y las pruebas de la interfaz.
- Si un administrador pasa una solicitud a "En revisión" sin escribir mensaje, la columna Respuesta mantiene el último mensaje anterior.
