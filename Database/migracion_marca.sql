-- Cambia el dominio de los correos de ejemplo (@acegrasco.com -> @portalautogestion.com).
-- Ejecutar UNA sola vez sobre la base portal_acegrasco ya existente (pestaña SQL de phpMyAdmin).
-- Después, los usuarios de ejemplo ingresan con, por ejemplo, jltrivino@portalautogestion.com.

USE portal_acegrasco;

UPDATE usuarios
   SET correo = REPLACE(correo, '@acegrasco.com', '@portalautogestion.com')
 WHERE correo LIKE '%@acegrasco.com';
