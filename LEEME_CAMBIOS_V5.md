# Cambios de la versión 5 (Usuarios y Empleados)

1. **Plantilla de Excel:** el módulo Empleados tiene otra vez el botón "Descargar plantilla de Excel" (hoja Empleados con los encabezados y hoja Instrucciones).
2. **Editar por documento:** en Usuarios y en Empleados hay un cuadro "Buscar por número de documento"; al buscar se cargan los datos para modificarlos. Ya no se escribe ningún ID.
3. **Datos personales:** el usuario tiene primer y segundo nombre, primer y segundo apellido y género (Masculino/Femenino). El nombre completo lo arma el sistema.
4. **Alta por pasos:** para crear un usuario primero se elige el tipo de documento y se escribe el número; si ya existe se avisa, y si no, se continúa con el resto de los datos.
5. **IDs internos:** los id los asigna la base de datos y ya no se muestran. Las solicitudes del administrador muestran el nombre y la cédula del empleado.

Además se corrigió un error que ya existía: la pantalla de Usuarios leía los datos de la API con otros nombres (`idUsuario` en vez de `id_usuario`), por lo que el rol se mostraba mal y no se podía editar.

## Paso a paso en MySQL (phpMyAdmin) si ya tienes la base con datos

1. Exporta un respaldo de `portal_acegrasco` (pestaña Exportar).
2. Pestaña **SQL** de la base `portal_acegrasco` → abre `Database/migracion_datos_personales.sql`, copia todo, pega y pulsa **Continuar**.
3. En la tabla `usuarios` → **Estructura** deben aparecer las columnas `tipo_documento`, `numero_documento`, `primer_nombre`, `segundo_nombre`, `primer_apellido`, `segundo_apellido` y `genero`.
4. Entra al portal → Usuarios y revisa cada nombre: la migración separa el nombre así (2 palabras = nombre + apellido; 3 = nombre + 2 apellidos; 4 o más = 2 nombres + 2 apellidos). **Corrige con Editar** los que quedaron mal y elige el **género** de cada uno.
5. En bases nuevas (o en TiDB) se importa directamente `portal_acegrasco_nube.sql`; ya trae todo.

En el script nuevo, los usuarios de ejemplo de Gennifer, Richard, Nicolás, Julio y Jennifer no tienen cargados todos los apellidos y el género se asignó según el nombre; ajústalos desde Usuarios.
