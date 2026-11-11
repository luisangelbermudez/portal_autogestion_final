-- Migración: datos personales en la tabla usuarios (tipo y número de documento, nombres, apellidos y género).
-- Ejecutar UNA sola vez sobre una base portal_acegrasco ya existente
-- (phpMyAdmin > base portal_acegrasco > pestaña SQL > pegar y ejecutar).
-- Si la base se creó con el script portal_acegrasco.sql actualizado, no hace falta.
--
-- Qué hace:
--  1) Agrega las columnas nuevas a usuarios.
--  2) Copia la cédula del empleado como número de documento del usuario (tipo CC).
--  3) Separa el nombre completo existente en nombres y apellidos (2 palabras = nombre + apellido;
--     3 = nombre + 2 apellidos; 4 o más = 2 nombres + 2 apellidos). Revisa el resultado en el
--     módulo Usuarios y corrige lo que haga falta.
--  4) El género queda vacío: se completa al editar cada usuario.

USE portal_acegrasco;

ALTER TABLE usuarios
  ADD COLUMN tipo_documento   VARCHAR(5)  NOT NULL DEFAULT 'CC' AFTER id_usuario,
  ADD COLUMN numero_documento VARCHAR(20) NULL AFTER tipo_documento,
  ADD COLUMN primer_nombre    VARCHAR(50) NULL AFTER numero_documento,
  ADD COLUMN segundo_nombre   VARCHAR(50) NULL AFTER primer_nombre,
  ADD COLUMN primer_apellido  VARCHAR(50) NULL AFTER segundo_nombre,
  ADD COLUMN segundo_apellido VARCHAR(50) NULL AFTER primer_apellido,
  ADD COLUMN genero           VARCHAR(10) NULL AFTER segundo_apellido,
  ADD COLUMN n_palabras_tmp   INT NULL,
  MODIFY COLUMN nombre VARCHAR(150) NOT NULL;

UPDATE usuarios u JOIN empleados e ON e.id_usuario = u.id_usuario
   SET u.numero_documento = e.cedula;

ALTER TABLE usuarios ADD UNIQUE KEY numero_documento (numero_documento);

UPDATE usuarios
   SET n_palabras_tmp = LENGTH(TRIM(nombre)) - LENGTH(REPLACE(TRIM(nombre), ' ', '')) + 1;

UPDATE usuarios SET
  primer_nombre    = SUBSTRING_INDEX(TRIM(nombre), ' ', 1),
  segundo_nombre   = CASE WHEN n_palabras_tmp >= 4 THEN SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(nombre), ' ', 2), ' ', -1) END,
  primer_apellido  = CASE
                       WHEN n_palabras_tmp = 2 THEN SUBSTRING_INDEX(TRIM(nombre), ' ', -1)
                       WHEN n_palabras_tmp = 3 THEN SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(nombre), ' ', 2), ' ', -1)
                       WHEN n_palabras_tmp >= 4 THEN SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(nombre), ' ', 3), ' ', -1)
                     END,
  segundo_apellido = CASE
                       WHEN n_palabras_tmp = 3 THEN SUBSTRING_INDEX(TRIM(nombre), ' ', -1)
                       WHEN n_palabras_tmp >= 4 THEN TRIM(SUBSTRING(TRIM(nombre), LENGTH(SUBSTRING_INDEX(TRIM(nombre), ' ', 3)) + 2))
                     END;

ALTER TABLE usuarios DROP COLUMN n_palabras_tmp;
