-- Migración: registra la fecha y hora del último ingreso de cada usuario.
-- Ejecutar UNA sola vez sobre una base de datos portal_acegrasco ya existente
-- (phpMyAdmin > base portal_acegrasco > pestaña SQL > pegar y ejecutar).
-- Si la base se creó con el script portal_acegrasco.sql actualizado, no hace falta.

USE portal_acegrasco;

ALTER TABLE usuarios
  ADD COLUMN ultimo_acceso DATETIME NULL
  COMMENT 'Fecha y hora del último inicio de sesión'
  AFTER id_estado;
